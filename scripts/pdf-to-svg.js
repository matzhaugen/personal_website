#!/usr/bin/env node
/**
 * Converts figure PDFs in /static into SVGs for use in blog posts.
 *
 * Browsers cannot render a PDF inside <img>, but they render SVG natively and
 * keep it crisp at any zoom level — which is the whole point of plotting to a
 * vector format in the first place. So we keep the PDF as the source of truth
 * (matplotlib/R output, also nice to link for download) and generate an SVG
 * sibling next to it.
 *
 * Requires poppler's pdftocairo:  brew install poppler
 *
 * The generated .svg files are committed to the repo — Netlify's build image
 * has no poppler, so conversion happens locally, not at deploy time.
 *
 * Usage:
 *   npm run figures                       # convert everything under /static
 *   npm run figures -- covid-mortality    # only that subdirectory
 *   npm run figures -- --force            # re-convert even if up to date
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sha256, loadManifest, saveManifest, STATIC_DIR } from './media-lib.js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const subdirs = args.filter((a) => !a.startsWith('--'));

/**
 * Figures live in per-post subdirectories (static/covid-mortality/...). Whole
 * documents meant to be downloaded as-is — the resume, article reprints — sit
 * at the top level of /static and are left alone.
 *
 * @param {string} dir
 * @param {boolean} isStaticRoot
 * @returns {string[]}
 */
function findPdfs(dir, isStaticRoot = false) {
	/** @type {string[]} */
	const found = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...findPdfs(path));
		else if (!isStaticRoot && entry.name.toLowerCase().endsWith('.pdf')) found.push(path);
	}
	return found;
}

try {
	execFileSync('pdftocairo', ['-v'], { stdio: 'ignore' });
} catch {
	console.error('pdftocairo not found. Install it with:  brew install poppler');
	process.exit(1);
}

const roots = subdirs.length ? subdirs.map((d) => join(STATIC_DIR, d)) : [STATIC_DIR];
const manifest = loadManifest();
let converted = 0;
let skipped = 0;

for (const root of roots) {
	for (const pdf of findPdfs(root, root === STATIC_DIR)) {
		const svg = pdf.replace(/\.pdf$/i, '.svg');
		const svgKey = relative(STATIC_DIR, svg);
		const pdfHash = sha256(pdf);

		// The recorded source hash is what makes staleness detectable after a
		// clone, where mtimes are all checkout time. mtime is still consulted as
		// a cheap first pass for the common local case.
		const upToDate =
			manifest.svgFromPdf[svgKey] === pdfHash ||
			(!(svgKey in manifest.svgFromPdf) &&
				(() => {
					try {
						return statSync(svg).mtimeMs >= statSync(pdf).mtimeMs;
					} catch {
						return false;
					}
				})());

		if (!force && upToDate) {
			manifest.svgFromPdf[svgKey] = pdfHash; // backfill for pre-manifest files
			skipped++;
			continue;
		}

		execFileSync('pdftocairo', ['-svg', pdf, svg]);
		manifest.svgFromPdf[svgKey] = pdfHash;
		console.log(`  ${svgKey}`);
		converted++;
	}
}

saveManifest(manifest);
console.log(`\n${converted} converted, ${skipped} already up to date.`);
