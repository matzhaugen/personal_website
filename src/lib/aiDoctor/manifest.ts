// One-shot loader for /ai-doctor/manifest.json. Cached in module scope so
// every retrieval call doesn't re-fetch.
import type { Manifest } from './types';

let cached: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
	if (!cached) {
		cached = fetch('/ai-doctor/manifest.json').then((r) => {
			if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
			return r.json();
		});
	}
	return cached;
}
