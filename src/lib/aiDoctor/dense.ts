// Dense retrieval: cosine similarity over a precomputed (n_chunks, dim) matrix
// of L2-normalized nomic embeddings, stored int8-quantized.
//
// Float32 vectors are incompressible, so at full-corpus size they dominate the
// browser's first load (51,486 x 768 x 4 = 158 MB). The export quantizes each
// vector symmetrically to int8 with its own scale — 4x smaller, ~1% recall cost
// because the vectors are unit-norm and so have a tight, uniform value range.
//
// The scale factors out of the dot product entirely:
//     dot(v_i, q) = dot(q_i * s_i, q) = s_i * dot(q_i, q)
// so the inner loop stays integer-by-float and each vector is rescaled exactly
// once, at the end. The query is left in float32 — quantizing it too would
// compound the error for no bandwidth gain, since it never leaves the browser.
//
// At ~51k chunks x 768 dims that is ~40M multiply-adds per query, tens of
// milliseconds in V8. No ANN structure needed; the rag-pipeline uses an exact
// FAISS IndexFlatIP for the same reason.
import { loadManifest } from './manifest';
import { indexUrl } from './assets';

interface DenseIndex {
	/** n_chunks * dim quantized values, row-major. */
	values: Int8Array;
	/** Per-vector dequantization scale, n_chunks long. */
	scales: Float32Array;
	n: number;
	dim: number;
}

let cached: Promise<DenseIndex> | null = null;

export function ensureDenseIndex(): Promise<DenseIndex> {
	if (!cached) {
		cached = (async () => {
			const manifest = await loadManifest();
			const { n_chunks: n, dim } = manifest;
			if (manifest.quant !== 'int8') {
				throw new Error(`unsupported embedding quantization: ${manifest.quant}`);
			}

			const r = await fetch(indexUrl('embeddings.i8', manifest.build_timestamp));
			if (!r.ok) throw new Error(`embeddings.i8 fetch failed: ${r.status}`);
			const buf = await r.arrayBuffer();

			// Scales are written first precisely so this Float32Array view starts
			// at offset 0 and is aligned whatever n*dim happens to be.
			const expected = n * 4 + n * dim;
			if (buf.byteLength !== expected) {
				throw new Error(
					`embeddings.i8 is ${buf.byteLength} bytes, expected ${expected} ` +
						`(n_chunks=${n}, dim=${dim})`
				);
			}
			return {
				scales: new Float32Array(buf, 0, n),
				values: new Int8Array(buf, n * 4, n * dim),
				n,
				dim
			};
		})();
	}
	return cached;
}

export async function searchDense(
	queryVec: Float32Array,
	k: number
): Promise<{ idx: number; score: number }[]> {
	const { values, scales, n, dim } = await ensureDenseIndex();
	if (queryVec.length !== dim) {
		throw new Error(`query dim ${queryVec.length} != index dim ${dim}`);
	}

	const scores = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const off = i * dim;
		let s = 0;
		for (let d = 0; d < dim; d++) s += values[off + d] * queryVec[d];
		scores[i] = s * scales[i];
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
