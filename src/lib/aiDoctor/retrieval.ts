// Top-level retrieval orchestrator. Mirrors vectorstore.search_hybrid plus
// the per-doc cap that the Python pipeline applies in the reranker.
// The reranker itself (bge-reranker-v2-m3, 568 MB) is dropped — too large
// for browsers — so we widen the candidate pool and lean on RRF + per-doc
// cap to compensate.
import type { Chunk, RetrievalResult } from './types';
import { embedQuery } from './embedder';
import { searchDense } from './dense';
import { searchSparse } from './bm25';

const INITIAL_K = 30;       // candidates per side before RRF
const FINAL_K = 5;          // chunks shown to the LLM after fusion
const MAX_PER_DOC = 3;      // cap so one paper doesn't dominate
const HYBRID_WEIGHT = 0.7;  // dense weight; sparse gets 1 - this
const K_RRF = 60;           // canonical RRF constant

// If even the top-scoring fused chunk doesn't clear this floor, the index
// has nothing relevant — return [] so prompt.ts's sources.length===0 branch
// fires and the LLM answers purely from general knowledge ([GK]). RRF
// scores are bounded (best possible ≈ 1/K_RRF = 0.0167 when a chunk is
// rank-0 in both lists); start permissive and tighten if off-topic answers
// still get retrieved chunks.
const GK_FALLBACK_RRF = 0.01;

let chunksCached: Promise<Chunk[]> | null = null;

export function ensureChunks() {
	if (!chunksCached) {
		chunksCached = fetch('/ai-doctor/chunks.json').then((r) => {
			if (!r.ok) throw new Error(`chunks.json fetch failed: ${r.status}`);
			return r.json();
		});
	}
	return chunksCached;
}

export type RetrievalProgress = (loaded: number, total: number, phase: string) => void;

export async function retrieve(
	query: string,
	onProgress?: RetrievalProgress
): Promise<RetrievalResult[]> {
	const chunks = await ensureChunks();
	const qVec = await embedQuery(query, onProgress);

	const [dense, sparse] = await Promise.all([
		searchDense(qVec, INITIAL_K),
		searchSparse(query, INITIAL_K)
	]);

	// Reciprocal Rank Fusion — combines lists by rank, not raw score, so it
	// is robust to scale mismatch between bounded cosine and unbounded BM25.
	const fused = new Map<number, number>();
	dense.forEach((r, rank) => {
		fused.set(r.idx, (fused.get(r.idx) ?? 0) + HYBRID_WEIGHT / (K_RRF + rank));
	});
	sparse.forEach((r, rank) => {
		fused.set(r.idx, (fused.get(r.idx) ?? 0) + (1 - HYBRID_WEIGHT) / (K_RRF + rank));
	});

	const ranked = [...fused.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([idx, score]) => ({ idx, score }));

	// Per-doc cap: spread evidence across distinct documents so a single
	// long post can't fill the whole context window.
	const perDoc = new Map<string, number>();
	const picked: { idx: number; score: number }[] = [];
	for (const r of ranked) {
		const docId = chunks[r.idx].doc_id;
		const cur = perDoc.get(docId) ?? 0;
		if (cur < MAX_PER_DOC) {
			picked.push(r);
			perDoc.set(docId, cur + 1);
		}
		if (picked.length >= FINAL_K) break;
	}

	// If the per-doc cap left us short of FINAL_K, top up ignoring the cap.
	// Matches the reranker's two-phase fill behavior.
	if (picked.length < FINAL_K) {
		const seen = new Set(picked.map((p) => p.idx));
		for (const r of ranked) {
			if (seen.has(r.idx)) continue;
			picked.push(r);
			if (picked.length >= FINAL_K) break;
		}
	}

	// GK fallback: if the best fused score is too weak, treat retrieval as
	// empty so the prompt switches to the GK-only path.
	if (picked.length === 0 || picked[0].score < GK_FALLBACK_RRF) {
		if (picked.length > 0 && typeof console !== 'undefined') {
			console.debug(
				`[aiDoctor] top RRF score ${picked[0].score.toFixed(4)} < ${GK_FALLBACK_RRF}; answering from GK only`
			);
		}
		return [];
	}

	return picked.map((p) => ({ chunk: chunks[p.idx], score: p.score }));
}
