#!/usr/bin/env node
/**
 * Runs the whole media pipeline in the one order that is correct:
 *
 *   1. npm run figures  — PDF → SVG
 *   2. npm run videos   — CRF-encode + faststart MP4s
 *   3. npm run assets   — upload to the DigitalOcean Space
 *
 * Steps 1 and 2 rewrite files in place, so uploading before them would ship
 * unprocessed assets — which is the whole reason this wrapper exists. Every
 * step is idempotent and skips work already done, so running this after each
 * export is cheap.
 *
 * Usage:
 *   npm run publish                     # every media directory
 *   npm run publish -- covid-mortality  # just one (passed to all three steps)
 *
 * Step-specific flags (--crf, --force, --delete, --dry-run) aren't forwarded;
 * run that step on its own when you need them.
 */

import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const dirs = argv.filter((a) => !a.startsWith('--'));

// --check verifies instead of mutating: the form a pre-push hook runs.
if (argv.includes('--check')) {
	const check = new URL('./check-media.js', import.meta.url).pathname;
	const passthrough = argv.filter((a) => a !== '--check');
	const { status } = spawnSync('node', [check, ...passthrough], { stdio: 'inherit' });
	process.exit(status ?? 1);
}
const scripts = [
	['figures', 'pdf-to-svg.js'],
	['videos', 'prepare-videos.js'],
	['assets', 'upload-assets.js']
];

for (const [label, script] of scripts) {
	console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
	const path = new URL(`./${script}`, import.meta.url).pathname;
	const { status } = spawnSync('node', [path, ...dirs], { stdio: 'inherit' });
	if (status !== 0) {
		console.error(`\n${label} failed (exit ${status}) — stopping before the remaining steps.`);
		process.exit(status ?? 1);
	}
}

console.log('\nAll steps complete.');
