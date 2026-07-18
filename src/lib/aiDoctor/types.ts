// Shared types for the RAG chat ("AI Doctor" tab). Retrieval always runs in the
// browser; generation runs either in the browser (WebLLM/WebGPU) or via a
// hosted model (Groq) proxied through our own /api/doctor-chat endpoint.

// Two generation backends:
//   - 'webllm' — runs in the visitor's browser via WebGPU. Fully private, but
//     needs a WebGPU-capable browser (Chrome/Edge/Safari 26+).
//   - 'groq'   — hosted Llama on Groq, proxied server-side so it works on any
//     browser (incl. Safari 18 / Firefox / mobile). Prompts leave the device.
export type ProviderId = 'webllm' | 'groq';

// Shape of an entry in /ai-doctor/chunks.json — written by
// rag-pipeline/scripts/export_for_web.py. The embedding-side `text` field
// (with the metadata header that nomic ingests) is dropped on export; only
// `raw_text` is kept since that's what the LLM sees in the prompt.
export interface Chunk {
	id: string;
	doc_id: string;
	raw_text: string;
	doc_title: string;
	section_heading: string;
	source_type: 'paper' | 'post';
	url: string | null;
	author?: string | null;
	published_at?: string | null;
}

export interface RetrievalResult {
	chunk: Chunk;
	score: number;
}

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	// Only set on assistant messages — the chunks that produced this answer.
	sources?: RetrievalResult[];
	// Wall-clock ms; used as id and for ordering.
	timestamp: number;
}

export interface LLMAdapterStreamOpts {
	system: string;
	messages: { role: 'user' | 'assistant'; content: string }[];
	temperature?: number;
	maxTokens?: number;
	// WebLLM emits weight-download progress before generation; other
	// providers ignore this. `phase` is a short status string for the UI.
	onProgress?: (loaded: number, total: number, phase: string) => void;
	abortSignal?: AbortSignal;
}

export interface LLMAdapter {
	id: ProviderId;
	stream(opts: LLMAdapterStreamOpts): AsyncIterable<string>;
}

export interface Manifest {
	schema_version: number;
	n_chunks: number;
	dim: number;
	embed_model: string;
	build_timestamp: number;
}

export interface Settings {
	provider: ProviderId;
	// Only WebLLM has a user-selectable model; the Groq model is fixed server-side.
	models: { webllm: string };
}

// Default to the hosted Groq backend: it works on every browser, whereas WebLLM
// needs WebGPU (and even then hits GPU limits on some Macs). Users who want
// fully-local/private inference can switch to WebLLM in Settings. The WebLLM
// default model is a small one that fits the 8-storage-buffer WebGPU limit
// macOS (Metal) enforces — the larger Llama-3.2-3B lib needs 10 and fails there.
export const DEFAULT_SETTINGS: Settings = {
	provider: 'groq',
	models: {
		webllm: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'
	}
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
	groq: 'Hosted (Groq) — fast, works on any browser',
	webllm: 'In your browser (WebLLM) — private, needs WebGPU'
};

// WebLLM model options surfaced in the settings UI. Sizes are approximate
// q4f16_1 download sizes; values are MLC model ids consumable by
// CreateMLCEngine() directly.
// Ordered smallest/most-compatible first. Models above the divider fit within
// the 8-storage-buffer limit macOS (Metal) enforces; Llama-3.2-3B needs 10 and
// only runs on GPUs/browsers that expose the higher limit (e.g. some Windows /
// Linux discrete GPUs), so it's last and flagged.
export const WEBLLM_MODELS: { id: string; label: string; sizeGB: number }[] = [
	{ id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B (recommended)', sizeGB: 0.95 },
	{ id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B (smallest/fastest)', sizeGB: 0.7 },
	{ id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 0.5B (tiny)', sizeGB: 0.5 },
	{ id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B', sizeGB: 1.4 },
	{ id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 Mini (bigger)', sizeGB: 2.2 },
	{ id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (needs WebGPU 10-buffer support)', sizeGB: 1.8 }
];
