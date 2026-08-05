// Top-level retrieval orchestrator. Mirrors vectorstore.search_hybrid plus
// the per-doc cap that the Python pipeline applies in the reranker.
// The reranker itself (bge-reranker-v2-m3, 568 MB) is dropped — too large
// for browsers — so we lean on RRF + the per-doc cap to compensate.
//
// Ranking runs over chunk *metadata* only; the bodies of the FINAL_K survivors
// are fetched at the end (see chunks.ts), which is why nothing here touches
// raw_text until the last step.
import type { Chunk, RetrievalResult } from './types';
import { embedQuery } from './embedder';
import { searchDense } from './dense';
import { searchSparse } from './bm25';
import { ensureChunkMeta, hydrate } from './chunks';

// Matches retrieval.initial_k in rag-pipeline's config.yaml. The browser has no
// reranker to salvage a bad pool, so it should not search a narrower one than
// the CLI does — especially at full-corpus size, where 30 candidates over 51k
// chunks is a much thinner slice than it was over the 11k posts-only index.
const INITIAL_K = 50;       // candidates per side before RRF
const FINAL_K = 5;          // chunks shown to the LLM after fusion
const MAX_PER_DOC = 3;      // cap so one paper doesn't dominate
const HYBRID_WEIGHT = 0.7;  // dense weight; sparse gets 1 - this
const K_RRF = 60;           // canonical RRF constant

// Relevance floor: below this, treat retrieval as empty so prompt.ts's
// sources.length===0 branch fires and the model says the library doesn't cover
// the question.
//
// This gates on the top *cosine* similarity, not on the fused RRF score. RRF
// scores are derived from rank alone, so whatever ranks first always earns
// ~HYBRID_WEIGHT/K_RRF ≈ 0.0117 no matter how irrelevant it is — the old 0.01
// RRF floor was structurally incapable of rejecting anything, and at
// full-corpus size it let plainly off-topic questions through with five
// confident-looking sources.
//
// Measured over the 51,486-chunk index (6 on-corpus vs 6 off-corpus queries):
//     on-corpus  top cosine  0.713 – 0.772
//     off-corpus top cosine  0.545 – 0.601
// 0.65 sits in that gap, biased slightly low: a weak-but-real answer is a
// better failure than wrongly refusing a question the library does cover, and
// the grounded prompt already makes the model state what isn't covered.
//
// BM25 was measured too and is NOT usable for this — its on/off-corpus ranges
// overlap (15.8–27.3 vs 11.8–15.9), since a rare token can score high in any
// document. Small sample; widen it before trusting the exact boundary.
const MIN_TOP_COSINE = 0.65;

/** Warm the metadata fetch before the user submits. Re-exported for the UI. */
export { ensureChunkMeta };

export type RetrievalProgress = (loaded: number, total: number, phase: string) => void;

export async function retrieve(
	query: string,
	onProgress?: RetrievalProgress
): Promise<RetrievalResult[]> {
	const { chunks } = await ensureChunkMeta();
	const qVec = await embedQuery(query, onProgress);

	const [dense, sparse] = await Promise.all([
		searchDense(qVec, INITIAL_K),
		searchSparse(query, INITIAL_K)
	]);

	// Bail before fusing: nothing in the library is semantically close enough.
	const topCosine = dense[0]?.score ?? 0;
	if (topCosine < MIN_TOP_COSINE) {
		if (typeof console !== 'undefined') {
			console.debug(
				`[aiDoctor] top cosine ${topCosine.toFixed(4)} < ${MIN_TOP_COSINE}; not in the library`
			);
		}
		return [];
	}

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
		const docId = chunks[r.idx].doc;
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

	if (picked.length === 0) return [];

	// Only now do the bodies get fetched — one Range request per contiguous run.
	const hydrated: Chunk[] = await hydrate(picked.map((p) => p.idx));
	return hydrated.map((chunk, i) => ({ chunk, score: picked[i].score }));
}
