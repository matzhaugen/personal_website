#!/usr/bin/env node
/**
 * Verifies that blog media has been fully processed and uploaded — the gate a
 * pre-push hook runs so half-processed figures never reach the remote.
 *
 * Three questions, all answered from content hashes rather than timestamps so
 * the result is identical on a fresh clone:
 *
 *   1. Does every PDF have an SVG generated from *that* PDF? (a re-exported
 *      figure whose SVG wasn't regenerated is the common miss)
 *   2. Is every MP4 CRF-encoded and faststart?
 *   3. Does every media file match what was last uploaded to the Space?
 *
 * Exits 0 when everything is current, 1 otherwise, printing the fix.
 *
 * Usage:
 *   npm run publish -- --check                    # everything
 *   npm run publish -- --check covid-mortality    # one directory
 *   node scripts/check-media.js --remote          # also HEAD the bucket
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sha256, listMedia, loadManifest, MEDIA_DIRS, STATIC_DIR } from './media-lib.js';

const args = process.argv.slice(2);
const checkRemote = args.includes('--remote');
const dirs = args.filter((a) => !a.startsWith('--'));
const scope = dirs.length ? dirs : MEDIA_DIRS;

const manifest = loadManifest();
/** @type {{kind: string, file: string, detail: string}[]} */
const problems = [];

/** @param {string} dir @param {RegExp} ext @returns {string[]} */
function filesIn(dir, ext) {
	/** @type {string[]} */
	const out = [];
	(function walk(d) {
		if (!existsSync(d)) return;
		for (const e of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (ext.test(e.name)) out.push(p);
		}
	})(join(STATIC_DIR, dir));
	return out;
}

// 1. figures ────────────────────────────────────────────────────────────────
for (const dir of scope) {
	for (const pdf of filesIn(dir, /\.pdf$/i)) {
		const svg = pdf.replace(/\.pdf$/i, '.svg');
		const key = relative(STATIC_DIR, svg);
		if (!existsSync(svg)) {
			problems.push({ kind: 'figures', file: key, detail: 'no SVG generated' });
		} else if (manifest.svgFromPdf[key] !== sha256(pdf)) {
			problems.push({
				kind: 'figures',
				file: key,
				detail: key in manifest.svgFromPdf ? 'PDF changed since conversion' : 'never recorded'
			});
		}
	}
}

// 2. videos ─────────────────────────────────────────────────────────────────
const haveFfprobe = (() => {
	try {
		execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
})();

for (const dir of scope) {
	for (const mp4 of filesIn(dir, /\.mp4$/i)) {
		const key = relative(STATIC_DIR, mp4);
		if (haveFfprobe) {
			const tag = execFileSync(
				'ffprobe',
				['-v', 'error', '-show_entries', 'format_tags=comment', '-of', 'default=nw=1:nk=1', mp4],
				{ encoding: 'utf8' }
			).trim();
			if (!tag.startsWith('site-encode:')) {
				problems.push({ kind: 'videos', file: key, detail: 'not CRF-encoded' });
				continue;
			}
		}
		// moov must precede mdat; cheap to verify from the first atoms.
		const order = execFileSync('node', [
			new URL('./mp4-faststart.js', import.meta.url).pathname,
			mp4,
			'/dev/null'
		])
			.toString()
			.includes('already faststart');
		if (!order) problems.push({ kind: 'videos', file: key, detail: 'moov not at front' });
	}
}

// 3. upload ─────────────────────────────────────────────────────────────────
for (const key of listMedia(scope)) {
	const local = sha256(join(STATIC_DIR, key));
	if (manifest.uploaded[key] !== local) {
		problems.push({
			kind: 'assets',
			file: key,
			detail: key in manifest.uploaded ? 'changed since upload' : 'never uploaded'
		});
	}
}

// Optional network confirmation that the bucket really holds these bytes.
if (checkRemote && problems.length === 0) {
	const base = 'https://stackmap.sfo3.cdn.digitaloceanspaces.com';
	for (const key of listMedia(scope)) {
		const code = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-I', `${base}/${key}`])
			.toString()
			.trim();
		if (code !== '200') problems.push({ kind: 'remote', file: key, detail: `HTTP ${code}` });
	}
}

// Report ────────────────────────────────────────────────────────────────────
if (problems.length === 0) {
	const n = listMedia(scope).length;
	console.log(`media check: ${n} file(s) current${checkRemote ? ', all reachable on the CDN' : ''}.`);
	process.exit(0);
}

const byKind = /** @type {Record<string, typeof problems>} */ ({});
for (const p of problems) (byKind[p.kind] ??= []).push(p);

console.error('media check FAILED\n');
const fixes = {
	figures: 'npm run figures',
	videos: 'npm run videos',
	assets: 'npm run assets',
	remote: 'npm run assets'
};
for (const [kind, list] of Object.entries(byKind)) {
	console.error(`  ${kind} (${list.length}) — fix with \`${fixes[kind]}\`:`);
	for (const p of list.slice(0, 8)) console.error(`    ${p.file} — ${p.detail}`);
	if (list.length > 8) console.error(`    …and ${list.length - 8} more`);
	console.error('');
}
console.error('Run `npm run publish` to do all three in order.');
process.exit(1);
