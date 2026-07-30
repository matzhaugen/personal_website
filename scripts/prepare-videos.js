#!/usr/bin/env node
/**
 * Prepares video figures in /static for the web.
 *
 * Two jobs, both idempotent, both on by default:
 *
 *   1. encode — re-encode with libx264 CRF 20 / veryslow. Plot animations come
 *      out of matplotlib at a fixed high bitrate that wastes most of its bits
 *      on a near-static image; a CRF encode cuts them ~5x with no visible
 *      difference. Needs ffmpeg (brew install ffmpeg); skipped with a notice if
 *      it isn't installed.
 *
 *   2. faststart — move the `moov` index atom ahead of the media data so a
 *      browser can start playback without first fetching the end of the file.
 *      Pure byte reshuffle, no quality cost, no ffmpeg needed. (An encode
 *      already writes the file this way.)
 *
 * Encoded files are tagged in their metadata, and tagged files are skipped on
 * later runs — re-encoding an encode would stack generational loss. So this is
 * safe to run after every export: fresh exports get compressed, files already
 * done are left alone.
 *
 * Usage:
 *   npm run videos                # encode untagged videos at CRF 20 + faststart
 *   npm run videos -- --crf 23    # smaller, still visually clean
 *   npm run videos -- --force     # re-encode even if already tagged
 *   npm run videos -- --no-encode # faststart only, no ffmpeg needed
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const STATIC_DIR = new URL('../static/', import.meta.url).pathname;
const FASTSTART = new URL('./mp4-faststart.js', import.meta.url).pathname;

const args = process.argv.slice(2);
const force = args.includes('--force');
let encode = !args.includes('--no-encode');
const crfArg = args.indexOf('--crf');
const crf = crfArg === -1 ? '20' : args[crfArg + 1];
const TAG = `site-encode:crf${crf}-veryslow`;

/** Videos live in per-post subdirectories, same convention as figure PDFs. */
function findVideos(dir, isStaticRoot = false) {
	const found = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...findVideos(path));
		else if (!isStaticRoot && /\.mp4$/i.test(entry.name)) found.push(path);
	}
	return found;
}

/** @param {string} bin */
function has(bin) {
	try {
		execFileSync(bin, ['-version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

if (encode && !has('ffmpeg')) {
	console.warn('ffmpeg not found — compressing skipped. Install it with:  brew install ffmpeg');
	console.warn('Continuing with faststart only.\n');
	encode = false;
}

/** Reads our own encode tag out of the container metadata. */
function existingTag(file) {
	if (!has('ffprobe')) return null;
	const out = execFileSync(
		'ffprobe',
		['-v', 'error', '-show_entries', 'format_tags=comment', '-of', 'default=nw=1:nk=1', file],
		{ encoding: 'utf8' }
	).trim();
	return out.startsWith('site-encode:') ? out : null;
}

const videos = findVideos(STATIC_DIR, true);
if (videos.length === 0) {
	console.log('No videos found under static/*/.');
	process.exit(0);
}

for (const file of videos) {
	const name = relative(STATIC_DIR, file);
	const before = statSync(file).size;

	if (encode) {
		const tag = existingTag(file);
		if (tag && !force) {
			console.log(`${name}: already encoded (${tag}) — skipping`);
		} else {
			const tmp = join(dirname(file), `.${Date.now()}.encode.mp4`);
			execFileSync('ffmpeg', [
				'-nostdin', '-v', 'error', '-y',
				'-i', file,
				'-c:v', 'libx264',
				'-crf', crf,
				'-preset', 'veryslow',
				'-pix_fmt', 'yuv420p',
				'-movflags', '+faststart',
				'-metadata', `comment=${TAG}`,
				'-an',
				tmp
			]);
			const after = statSync(tmp).size;
			if (after >= before && !force) {
				// Encoding made it bigger — the source was already efficient.
				unlinkSync(tmp);
				console.log(`${name}: encode was larger than source — kept original`);
				continue;
			}
			renameSync(tmp, file);
			const pct = ((after / before) * 100).toFixed(1);
			console.log(
				`${name}: encoded CRF ${crf} — ` +
					`${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (${pct}%)`
			);
			continue; // ffmpeg already wrote it faststart
		}
	}

	// Always make sure the index is up front, encoded or not.
	execFileSync('node', [FASTSTART, file], { stdio: 'inherit' });
}
