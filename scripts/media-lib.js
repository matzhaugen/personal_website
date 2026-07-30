/**
 * Shared vocabulary for the media pipeline: which directories count as blog
 * media, how files are hashed, and where the manifest lives.
 *
 * The manifest records content hashes rather than timestamps. Git does not
 * preserve mtimes, so a fresh clone gives every file the checkout time and any
 * mtime comparison becomes meaningless — fine for a local convenience check,
 * useless as a push gate. Hashes are stable across clones and machines.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const STATIC_DIR = new URL('../static/', import.meta.url).pathname;
export const MANIFEST_PATH = new URL('../media-manifest.json', import.meta.url).pathname;

/**
 * Per-post media directories. Deliberately a list rather than "everything in
 * static/": static/data is read server-side at build time, and the loose files
 * at the static root are wired into pages by absolute path.
 */
export const MEDIA_DIRS = [
	'covid-mortality',
	'excess-mort-nor',
	'excess-mort-en',
	'vaccine-intro',
	'5g-are-there-biological-impacts',
	'vax-deaths-averted',
	'fan-wu'
];

/**
 * Files the upload step skips. Everything else in a media directory is synced,
 * so the manifest tracks everything else too — otherwise "check passed" would
 * be silent about, say, a changed notebook sitting alongside the figures.
 */
export const UPLOAD_EXCLUDED = /(^|\/)\.DS_Store$/;

/** @param {string} file @returns {string} */
export function sha256(file) {
	return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/**
 * Every file the upload step would sync, as paths relative to static/ (which is
 * also the object key in the bucket).
 *
 * @param {string[]} [dirs]
 * @returns {string[]}
 */
export function listMedia(dirs = MEDIA_DIRS) {
	/** @type {string[]} */
	const found = [];

	/** @param {string} dir */
	function walk(dir) {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (!UPLOAD_EXCLUDED.test(entry.name)) found.push(relative(STATIC_DIR, path));
		}
	}

	for (const d of dirs) walk(join(STATIC_DIR, d));
	return found.sort();
}

/** @returns {{version: number, svgFromPdf: Record<string,string>, uploaded: Record<string,string>}} */
export function loadManifest() {
	if (!existsSync(MANIFEST_PATH)) return { version: 1, svgFromPdf: {}, uploaded: {} };
	const m = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
	return { version: 1, svgFromPdf: {}, uploaded: {}, ...m };
}

/** @param {ReturnType<typeof loadManifest>} manifest */
export function saveManifest(manifest) {
	const sortKeys = (/** @type {Record<string,string>} */ o) =>
		Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

	const out = {
		version: 1,
		svgFromPdf: sortKeys(manifest.svgFromPdf),
		uploaded: sortKeys(manifest.uploaded)
	};
	// Sorted and newline-terminated so the committed file diffs cleanly.
	writeFileSync(MANIFEST_PATH, JSON.stringify(out, null, '\t') + '\n');
}
