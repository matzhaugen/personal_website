// Chunk metadata, and lazy fetching of chunk bodies.
//
// Retrieval ranks over all ~51k chunks but only ever shows FINAL_K of them to
// the model, so shipping every body up front wastes ~110 MB of the visitor's
// bandwidth to use ~10 kB of it. Instead:
//   - chunks-meta.json  carries what ranking and citation need (doc grouping,
//     titles, URLs, section headings) with doc-level fields deduplicated across
//     each document's ~15 chunks.
//   - chunks-text.bin   carries the bodies back to back, addressed by byte
//     offset, and is read with HTTP Range requests for the selected chunks only.
import type { Chunk, ChunkIndex, ChunkMeta, DocMeta } from './types';
import { indexUrl } from './assets';
import { loadManifest } from './manifest';

// Adjacent requests are coalesced when the gap between them is smaller than
// this — pulling a few spare kilobytes beats paying for another round trip.
const COALESCE_GAP = 8 * 1024;

// Bodies already decoded, keyed by chunk index. Bounded because the store is
// long-lived across a session; the working set is tiny (FINAL_K per query).
const MAX_CACHED_BODIES = 500;
const bodyCache = new Map<number, string>();

let metaCached: Promise<ChunkIndex> | null = null;
// Set only if the CDN ignores our Range header and hands back the whole file.
let wholeFile: ArrayBuffer | null = null;

export function ensureChunkMeta(): Promise<ChunkIndex> {
	if (!metaCached) {
		// Versioned against the manifest. This pair is the one place a stale edge
		// copy would fail SILENTLY rather than loudly: the offsets in
		// chunks-meta.json address chunks-text.bin byte-for-byte, so mixing a
		// rebuilt index with a cached old one decodes real text at wrong
		// boundaries — plausible-looking garbage attributed to real sources.
		metaCached = loadManifest().then((m) =>
			fetch(indexUrl('chunks-meta.json', m.build_timestamp)).then((r) => {
				if (!r.ok) throw new Error(`chunks-meta.json fetch failed: ${r.status}`);
				return r.json();
			})
		);
	}
	return metaCached;
}

/** Join a chunk with its document metadata and body into the shape prompts use. */
function join(meta: ChunkMeta, doc: DocMeta, raw_text: string): Chunk {
	return {
		id: meta.id,
		doc_id: meta.doc,
		raw_text,
		doc_title: doc.title,
		section_heading: meta.sec,
		source_type: doc.type,
		url: doc.url ?? null,
		author: doc.author ?? null,
		published_at: doc.published_at ?? null,
		doi: doc.doi ?? null,
		authors: doc.authors ?? null,
		year: doc.year ?? null,
		journal: doc.journal ?? null
	};
}

/**
 * Fetch and decode the bodies for `indices`, then return fully joined chunks in
 * the same order.
 */
export async function hydrate(indices: number[]): Promise<Chunk[]> {
	const { docs, chunks } = await ensureChunkMeta();

	const missing = indices.filter((i) => !bodyCache.has(i));
	if (missing.length > 0) await fetchBodies(missing, chunks);

	return indices.map((i) => {
		const meta = chunks[i];
		return join(meta, docs[meta.doc], bodyCache.get(i) ?? '');
	});
}

async function fetchBodies(indices: number[], chunks: ChunkMeta[]): Promise<void> {
	const decoder = new TextDecoder();
	// Same version as the offsets we are about to address it with — see the note
	// in ensureChunkMeta about why a mismatch here is silent rather than loud.
	const { build_timestamp } = await loadManifest();

	// If a previous request revealed that Range isn't honored, slice locally.
	if (wholeFile) {
		for (const i of indices) {
			const { off, len } = chunks[i];
			cacheBody(i, decoder.decode(new Uint8Array(wholeFile, off, len)));
		}
		return;
	}

	// Group into contiguous byte spans so N nearby chunks cost one request.
	const sorted = [...indices].sort((a, b) => chunks[a].off - chunks[b].off);
	const spans: { start: number; end: number; members: number[] }[] = [];
	for (const i of sorted) {
		const { off, len } = chunks[i];
		const last = spans[spans.length - 1];
		if (last && off - last.end <= COALESCE_GAP) {
			last.end = Math.max(last.end, off + len);
			last.members.push(i);
		} else {
			spans.push({ start: off, end: off + len, members: [i] });
		}
	}

	await Promise.all(
		spans.map(async (span) => {
			// HTTP byte ranges are inclusive on both ends.
			const res = await fetch(indexUrl('chunks-text.bin', build_timestamp), {
				headers: { Range: `bytes=${span.start}-${span.end - 1}` }
			});
			if (!res.ok) throw new Error(`chunks-text.bin fetch failed: ${res.status}`);
			const buf = await res.arrayBuffer();

			if (res.status === 200) {
				// Range was ignored and this is the entire file. Keep it so we
				// degrade to one big download instead of refetching per query.
				wholeFile = buf;
				for (const i of span.members) {
					const { off, len } = chunks[i];
					cacheBody(i, decoder.decode(new Uint8Array(buf, off, len)));
				}
				return;
			}

			const bytes = new Uint8Array(buf);
			for (const i of span.members) {
				const { off, len } = chunks[i];
				const from = off - span.start;
				cacheBody(i, decoder.decode(bytes.subarray(from, from + len)));
			}
		})
	);
}

function cacheBody(idx: number, text: string): void {
	if (bodyCache.size >= MAX_CACHED_BODIES) {
		// Map iterates in insertion order, so this drops the oldest entry.
		const oldest = bodyCache.keys().next();
		if (!oldest.done) bodyCache.delete(oldest.value);
	}
	bodyCache.set(idx, text);
}
