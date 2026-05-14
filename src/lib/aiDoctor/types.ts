// Shared types for the in-browser RAG chat ("AI Doctor" tab).
// The pipeline mirrors rag-pipeline's retrieve → prompt → generate flow but
// runs entirely in the browser; nothing here ever talks to our own server.

export type ProviderId = 'webllm' | 'anthropic' | 'openai' | 'xai' | 'gemini';
export type ByokProviderId = Exclude<ProviderId, 'webllm'>;

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
	// One model id per provider. Lets the user pick between e.g.
	// claude-sonnet-4-6 and claude-haiku-4-5 without losing the other choice
	// when they switch providers.
	models: Record<ProviderId, string>;
	// API keys for the four BYOK providers. Stored in localStorage; never
	// leaves the browser. WebLLM doesn't have a key.
	keys: Record<ByokProviderId, string>;
}

// Sensible defaults — picked to match the rag-pipeline's quality bar where
// possible. User-overridable via the settings drawer.
export const DEFAULT_SETTINGS: Settings = {
	provider: 'webllm',
	models: {
		webllm: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
		anthropic: 'claude-sonnet-4-6',
		openai: 'gpt-4o',
		xai: 'grok-2-latest',
		gemini: 'gemini-1.5-flash-latest'
	},
	keys: {
		anthropic: '',
		openai: '',
		xai: '',
		gemini: ''
	}
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
	webllm: 'WebLLM (in browser)',
	anthropic: 'Anthropic Claude',
	openai: 'OpenAI',
	xai: 'xAI Grok',
	gemini: 'Google Gemini'
};

// WebLLM model options surfaced in the settings UI. Sizes are approximate
// q4f16_1 download sizes; values are MLC model ids consumable by
// CreateMLCEngine() directly.
export const WEBLLM_MODELS: { id: string; label: string; sizeGB: number }[] = [
	{ id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (recommended)', sizeGB: 1.8 },
	{ id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B (small/fast)', sizeGB: 0.95 },
	{ id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 Mini (bigger/better)', sizeGB: 2.2 }
];
