// Shared types for the RAG chat ("AI Doctor" tab). Retrieval runs in the
// browser; generation is a hosted model proxied through our own
// /api/doctor-chat endpoint so the keys stay server-side. There is one
// CLIENT-side backend by design — the in-browser WebLLM path was removed
// because it needed WebGPU + shader-f16, which Firefox/older Safari/iOS don't
// reliably provide, so it failed outright for a large share of visitors.
//
// Which hosted vendor answers is chosen server-side per request (Cerebras,
// then Groq on failover), so the browser has exactly one adapter regardless.
export type ProviderId = 'hosted';

// Per-document metadata, stored once in chunks-meta.json rather than repeated
// across each document's ~15 chunks. `doi`/`authors`/`year`/`journal` come from
// rag-pipeline's papers_metadata.json sidecar and are absent on posts (and on
// papers ingested before that sidecar existed), so treat them as optional.
export interface DocMeta {
	title: string;
	type: 'paper' | 'post';
	url?: string | null;
	author?: string | null;
	published_at?: string | null;
	doi?: string | null;
	authors?: string[] | null;
	year?: number | null;
	journal?: string | null;
}

// Per-chunk record in chunks-meta.json. Deliberately small: it exists 51k times
// over, and the body it points at lives in chunks-text.bin, fetched by Range
// request only for the handful of chunks a query actually selects.
export interface ChunkMeta {
	id: string;
	/** Key into the `docs` map. */
	doc: string;
	/** Section heading. */
	sec: string;
	/** Byte offset into chunks-text.bin. */
	off: number;
	/** Byte length of the UTF-8 body. */
	len: number;
}

export interface ChunkIndex {
	docs: Record<string, DocMeta>;
	chunks: ChunkMeta[];
}

// A chunk joined with its document metadata and its body — what the prompt and
// the UI actually consume. Built by chunks.ts:hydrate() for the final few
// chunks only, so `raw_text` is always populated here.
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
	doi?: string | null;
	authors?: string[] | null;
	year?: number | null;
	journal?: string | null;
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
	abortSignal?: AbortSignal;
	/** Which hosted vendor served this answer, once known. Diagnostics only —
	 *  the models differ enough that a bad answer is worth attributing. */
	onProvider?: (id: string) => void;
}

export interface LLMAdapter {
	id: ProviderId;
	stream(opts: LLMAdapterStreamOpts): AsyncIterable<string>;
}

// Written by rag-pipeline/scripts/export_for_web.py. `schema_version` is
// checked before any binary asset is parsed — a mismatched export must fail
// loudly rather than reinterpret bytes under the wrong layout.
export const SCHEMA_VERSION = 2;

export interface Manifest {
	schema_version: number;
	n_chunks: number;
	dim: number;
	/** Quantization of embeddings.i8. Only 'int8' exists today. */
	quant: 'int8';
	n_docs: number;
	/** BM25 vocabulary size = number of columns in the inverted index. */
	n_terms: number;
	/** Total BM25 postings (nonzeros), needed to size the typed-array views. */
	bm25_nnz: number;
	/** Mean document length, for the BM25 length normalization. */
	avg_dl: number;
	embed_model: string;
	build_timestamp: number;
}

// The generation model is fixed server-side in /api/doctor-chat, so there is
// nothing for the visitor to configure — no settings store, no drawer.
