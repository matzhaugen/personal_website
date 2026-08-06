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
 *
 * ── cache busting, and why it is not optional ──────────────────────────────
 * The CDN caches by URL with a 24h TTL, and re-uploading an object does NOT
 * evict an edge copy that is still within its TTL. Publishing a rebuilt index
 * therefore used to leave visitors on a mix of old and new files for up to a
 * day (observed 2026-08-06: every binary refreshed while manifest.json served
 * a nine-month-old schema_version 1 for another 16 hours).
 *
 * So every asset except the manifest is requested with `?v=<build_timestamp>`,
 * taken from the manifest. A rebuilt index changes that timestamp, which
 * changes the URL, which cannot hit a stale edge entry — the old objects simply
 * age out on their own. The manifest itself can't use this (it's where the
 * timestamp comes from), so it gets a time-bucketed parameter instead; see
 * manifest.ts.
 */
const ASSET_BASE = import.meta.env.VITE_ASSET_BASE ?? '';

/**
 * @param file bare filename, e.g. 'embeddings.i8'
 * @param version manifest.build_timestamp. Omit ONLY for manifest.json itself —
 *   an unversioned asset URL can be served from a stale edge cache after a
 *   re-upload, which pairs new metadata with old bytes.
 */
export function indexUrl(file: string, version?: number | string): string {
	const url = `${ASSET_BASE}/ai-doctor/${file}`;
	return version === undefined ? url : `${url}?v=${version}`;
}
