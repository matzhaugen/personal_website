/**
 * Resolves the location of the retrieval index files.
 *
 * The index (embeddings.i8, chunks-meta.json, chunks-text.bin, bm25.bin,
 * bm25-vocab.json, manifest.json) runs to tens of megabytes and used to be
 * committed under static/ai-doctor, which made it ~60% of the whole repository
 * and part of every clone. It now lives in the DigitalOcean Space `stackmap`
 * and is uploaded with `npm run assets`; VITE_ASSET_BASE points at the CDN in
 * production (set in netlify.toml). Leave the variable unset — as in local dev
 * — and these resolve to /ai-doctor/... under static/ as before.
 *
 * The CDN must honor HTTP Range requests: chunks.ts reads individual chunk
 * bodies out of chunks-text.bin by byte offset rather than downloading it.
 */
const ASSET_BASE = import.meta.env.VITE_ASSET_BASE ?? '';

/** @param file bare filename, e.g. 'embeddings.bin' */
export function indexUrl(file: string): string {
	return `${ASSET_BASE}/ai-doctor/${file}`;
}
