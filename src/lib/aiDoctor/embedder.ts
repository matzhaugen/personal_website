// Browser-side query embedder. Uses transformers.js to run nomic-embed-text-v1.5
// in ONNX. The model + tokenizer auto-download from the HF CDN on first use
// and are cached in IndexedDB by transformers.js itself.
//
// We MUST match the rag-pipeline's encoding exactly — same model, same task
// prefix, same L2 normalization — or the dot-product against precomputed
// embeddings will be meaningless.
import type { FeatureExtractionPipeline } from '@huggingface/transformers';

const MODEL_ID = 'nomic-ai/nomic-embed-text-v1.5';
const QUERY_PREFIX = 'search_query: ';

type ProgressCallback = (loaded: number, total: number, phase: string) => void;

let extractor: Promise<FeatureExtractionPipeline> | null = null;

export async function ensureEmbedder(onProgress?: ProgressCallback) {
	if (!extractor) {
		extractor = (async () => {
			const { pipeline } = await import('@huggingface/transformers');
			return pipeline('feature-extraction', MODEL_ID, {
				progress_callback: (p: { status: string; loaded?: number; total?: number; file?: string }) => {
					if (onProgress && p.status === 'progress' && p.loaded != null && p.total != null) {
						onProgress(p.loaded, p.total, `embedder: ${p.file ?? ''}`);
					}
				}
			}) as Promise<FeatureExtractionPipeline>;
		})();
	}
	return extractor;
}

export async function embedQuery(
	text: string,
	onProgress?: ProgressCallback
): Promise<Float32Array> {
	const ext = await ensureEmbedder(onProgress);
	const out = await ext(QUERY_PREFIX + text, { pooling: 'mean', normalize: true });
	// Tensor.data is the underlying Float32Array of shape (1, dim) flattened.
	const data = out.data as Float32Array;
	if (!(data instanceof Float32Array)) {
		throw new Error('embedder did not return Float32Array');
	}
	return data;
}
