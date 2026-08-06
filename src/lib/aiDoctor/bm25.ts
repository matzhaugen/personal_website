// BM25 sparse retrieval — JS port of vectorstore.py:search_sparse.
// Same tokenizer (regex \b\w{2,}\b lowercased), same constants k1=1.5, b=0.75,
// same +1 IDF variant. That parity is load-bearing: the browser and the Python
// CLI are meant to retrieve identically over the same index.
//
// The index is a term-major inverted index (CSC), not the doc-major CSR the
// pipeline builds. Two reasons:
//   - Scoring touches only the postings of the query's own terms, instead of
//     walking all ~51k documents' term lists to find the few that match.
//   - It ships as binary. The corpus has ~8M postings; as JSON integers that
//     is ~90 MB before compression.
// Doc ids ascend within a term, so they are stored as deltas and accumulated
// on read — the high bytes go to zero and the CDN's gzip collapses them.
import { loadManifest } from './manifest';
import { indexUrl } from './assets';

const K1 = 1.5;
const B = 0.75;

interface Bm25Data {
	vocab: Record<string, number>;
	avgDl: number;
	nDocs: number;
	nTerms: number;
	idf: Float32Array;
	docLens: Int32Array;
	/** nTerms+1 offsets into docIds/tf. */
	indptr: Int32Array;
	/** Delta-coded doc ids; first entry of each term's run is absolute. */
	docDeltas: Int32Array;
	tf: Uint8Array;
}

let cached: Promise<Bm25Data> | null = null;

export function ensureBm25(): Promise<Bm25Data> {
	if (!cached) {
		cached = (async () => {
			const manifest = await loadManifest();
			const { n_chunks: nDocs, n_terms: nTerms, bm25_nnz: nnz, avg_dl: avgDl } = manifest;

			const [binRes, vocabRes] = await Promise.all([
				fetch(indexUrl('bm25.bin', manifest.build_timestamp)),
				fetch(indexUrl('bm25-vocab.json', manifest.build_timestamp))
			]);
			if (!binRes.ok) throw new Error(`bm25.bin fetch failed: ${binRes.status}`);
			if (!vocabRes.ok) throw new Error(`bm25-vocab.json fetch failed: ${vocabRes.status}`);

			const [buf, vocab] = await Promise.all([binRes.arrayBuffer(), vocabRes.json()]);

			// Section order must match export_bm25(). Everything before `tf` is
			// 4-byte wide, so each typed-array view lands naturally aligned.
			let off = 0;
			const idf = new Float32Array(buf, off, nTerms);
			off += nTerms * 4;
			const docLens = new Int32Array(buf, off, nDocs);
			off += nDocs * 4;
			const indptr = new Int32Array(buf, off, nTerms + 1);
			off += (nTerms + 1) * 4;
			const docDeltas = new Int32Array(buf, off, nnz);
			off += nnz * 4;
			const tf = new Uint8Array(buf, off, nnz);
			off += nnz;

			if (off !== buf.byteLength) {
				throw new Error(`bm25.bin is ${buf.byteLength} bytes, expected ${off}`);
			}
			return { vocab, avgDl, nDocs, nTerms, idf, docLens, indptr, docDeltas, tf };
		})();
	}
	return cached;
}

export function tokenize(text: string): string[] {
	return text.toLowerCase().match(/\b\w{2,}\b/g) ?? [];
}

export async function searchSparse(
	query: string,
	k: number
): Promise<{ idx: number; score: number }[]> {
	const bm = await ensureBm25();

	// Terms not in the vocabulary are silently dropped, matching the Python
	// pipeline. Deduplicated: a term repeated in the query would otherwise
	// double-count its own postings.
	const cols = new Set<number>();
	for (const t of tokenize(query)) {
		const col = bm.vocab[t];
		if (col !== undefined) cols.add(col);
	}

	if (cols.size === 0) {
		// No overlap → BM25 contributes nothing; return a zero-score head so RRF
		// still has a list to fuse. Matches search_sparse's empty-overlap fallback.
		const out: { idx: number; score: number }[] = [];
		for (let i = 0; i < Math.min(k, bm.nDocs); i++) out.push({ idx: i, score: 0 });
		return out;
	}

	const scores = new Float32Array(bm.nDocs);
	for (const col of cols) {
		const start = bm.indptr[col];
		const end = bm.indptr[col + 1];
		const idf = bm.idf[col];
		let doc = 0;
		for (let p = start; p < end; p++) {
			// Deltas restart at each term's first posting, which is absolute.
			doc = p === start ? bm.docDeltas[p] : doc + bm.docDeltas[p];
			const freq = bm.tf[p];
			const lenNorm = 1 - B + B * (bm.docLens[doc] / bm.avgDl);
			scores[doc] += (idf * (freq * (K1 + 1))) / (freq + K1 * lenNorm);
		}
	}

	return topK(scores, k);
}

function topK(scores: Float32Array, k: number): { idx: number; score: number }[] {
	const heap: { idx: number; score: number }[] = [];
	for (let i = 0; i < scores.length; i++) {
		const s = scores[i];
		if (heap.length < k) {
			heap.push({ idx: i, score: s });
			if (heap.length === k) heap.sort((a, b) => a.score - b.score);
		} else if (s > heap[0].score) {
			heap[0] = { idx: i, score: s };
			heap.sort((a, b) => a.score - b.score);
		}
	}
	return heap.sort((a, b) => b.score - a.score);
}
