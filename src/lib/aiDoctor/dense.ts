// Dense retrieval: cosine similarity over a precomputed (n_chunks, dim) matrix
// of L2-normalized nomic embeddings. Both the corpus vectors and the query
// vector are L2-normalized, so dot product == cosine similarity.
//
// At ~11k chunks × 768 dims, scanning the full matrix per query is ~8.5M
// multiply-adds — comfortably under 20 ms in V8. No need for ANN structures
// at this scale; the rag-pipeline uses an exact FAISS IndexFlatIP for the
// same reason.
import { loadManifest } from './manifest';

let cached: Promise<{ matrix: Float32Array; n: number; dim: number }> | null = null;

export function ensureDenseIndex() {
	if (!cached) {
		cached = (async () => {
			const manifest = await loadManifest();
			const r = await fetch('/ai-doctor/embeddings.bin');
			if (!r.ok) throw new Error(`embeddings.bin fetch failed: ${r.status}`);
			const buf = await r.arrayBuffer();
			const matrix = new Float32Array(buf);
			const expected = manifest.n_chunks * manifest.dim;
			if (matrix.length !== expected) {
				throw new Error(
					`embeddings.bin length ${matrix.length} != n_chunks*dim ${expected}`
				);
			}
			return { matrix, n: manifest.n_chunks, dim: manifest.dim };
		})();
	}
	return cached;
}

export async function searchDense(
	queryVec: Float32Array,
	k: number
): Promise<{ idx: number; score: number }[]> {
	const { matrix, n, dim } = await ensureDenseIndex();
	if (queryVec.length !== dim) {
		throw new Error(`query dim ${queryVec.length} != index dim ${dim}`);
	}

	const scores = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const off = i * dim;
		let s = 0;
		for (let d = 0; d < dim; d++) s += matrix[off + d] * queryVec[d];
		scores[i] = s;
	}

	return topK(scores, k);
}

// Partial-sort top-k via a fixed-size min-heap kept on a typed array.
// Cheaper than sorting all n scores when k << n.
function topK(scores: Float32Array, k: number): { idx: number; score: number }[] {
	const heap: { idx: number; score: number }[] = [];
	for (let i = 0; i < scores.length; i++) {
		const s = scores[i];
		if (heap.length < k) {
			heap.push({ idx: i, score: s });
			if (heap.length === k) heap.sort((a, b) => a.score - b.score); // ascending
		} else if (s > heap[0].score) {
			heap[0] = { idx: i, score: s };
			// re-sift the new minimum down — small k makes a full re-sort fine
			heap.sort((a, b) => a.score - b.score);
		}
	}
	return heap.sort((a, b) => b.score - a.score);
}
