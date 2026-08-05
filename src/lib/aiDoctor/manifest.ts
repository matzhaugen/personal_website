// One-shot loader for /ai-doctor/manifest.json. Cached in module scope so
// every retrieval call doesn't re-fetch.
import type { Manifest } from './types';
import { SCHEMA_VERSION } from './types';
import { indexUrl } from './assets';

let cached: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
	if (!cached) {
		cached = fetch(indexUrl('manifest.json'))
			.then((r) => {
				if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
				return r.json();
			})
			.then((m: Manifest) => {
				// Every other asset is a raw byte layout keyed to this version.
				// Reading a v1 export with v2 offsets yields plausible-looking
				// nonsense, so refuse instead — re-run export_for_web.py and
				// `npm run assets`.
				if (m.schema_version !== SCHEMA_VERSION) {
					throw new Error(
						`index schema_version ${m.schema_version} != expected ${SCHEMA_VERSION} — ` +
							're-export the index (rag-pipeline/scripts/export_for_web.py) and re-upload it'
					);
				}
				return m;
			});
	}
	return cached;
}
