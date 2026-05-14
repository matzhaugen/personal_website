// BM25 sparse retrieval — JS port of vectorstore.py:search_sparse.
// Same tokenizer (regex \b\w{2,}\b lowercased), same constants k1=1.5, b=0.75,
// same +1 IDF variant. Reads the CSR triplet emitted by the export script.

const K1 = 1.5;
const B = 0.75;

interface Bm25Data {
	vocab: Record<string, number>;
	avg_dl: number;
	n_docs: number;
	idf: Float32Array;
	doc_lens: Int32Array;
	indptr: Int32Array;
	indices: Int32Array;
	data: Int32Array;
}

let cached: Promise<Bm25Data> | null = null;

export function ensureBm25() {
	if (!cached) {
		cached = (async () => {
			const r = await fetch('/ai-doctor/bm25.json');
			if (!r.ok) throw new Error(`bm25.json fetch failed: ${r.status}`);
			const j = await r.json();
			return {
				vocab: j.vocab,
				avg_dl: j.avg_dl,
				n_docs: j.n_docs,
				idf: Float32Array.from(j.idf),
				doc_lens: Int32Array.from(j.doc_lens),
				indptr: Int32Array.from(j.tf.indptr),
				indices: Int32Array.from(j.tf.indices),
				data: Int32Array.from(j.tf.data)
			};
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
	const terms = tokenize(query);
	// Set of vocab column ids that appear in the query — terms not in vocab
	// are silently dropped, matching the Python pipeline.
	const qcols = new Set<number>();
	for (const t of terms) {
		const col = bm.vocab[t];
		if (col !== undefined) qcols.add(col);
	}
	if (qcols.size === 0) {
		// No overlap → BM25 contributes nothing; return zero-score head so RRF
		// has something to work with. Matches search_sparse's empty-overlap
		// fallback.
		const out: { idx: number; score: number }[] = [];
		for (let i = 0; i < Math.min(k, bm.n_docs); i++) out.push({ idx: i, score: 0 });
		return out;
	}

	const scores = new Float32Array(bm.n_docs);
	for (let d = 0; d < bm.n_docs; d++) {
		const start = bm.indptr[d];
		const end = bm.indptr[d + 1];
		if (start === end) continue;
		const lenNorm = 1 - B + B * (bm.doc_lens[d] / bm.avg_dl);
		let s = 0;
		for (let p = start; p < end; p++) {
			const col = bm.indices[p];
			if (qcols.has(col)) {
				const tf = bm.data[p];
				s += bm.idf[col] * (tf * (K1 + 1)) / (tf + K1 * lenNorm);
			}
		}
		scores[d] = s;
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
