#!/usr/bin/env node
/**
 * Moves an MP4's `moov` index atom in front of the media data ("faststart").
 *
 * Encoders write `moov` last by default, which means a browser cannot know how
 * to play the file until it has the tail — so `preload="metadata"` degrades
 * into fetching the entire video just to render a first frame. Moving `moov` to
 * the front makes playback start after a few KB.
 *
 * This is a byte-level remux, not a re-encode: pixels are untouched. Chunk
 * offsets in every stco/co64 table are shifted by the number of bytes inserted.
 * (Same job as ffmpeg's `-movflags +faststart` / qt-faststart, without needing
 * ffmpeg installed.)
 *
 * Usage:
 *   node scripts/mp4-faststart.js static/covid-mortality/statewide_excess_map.mp4
 *   node scripts/mp4-faststart.js in.mp4 out.mp4     # leave the original alone
 */

import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input) {
	console.error('usage: node scripts/mp4-faststart.js <in.mp4> [out.mp4]');
	process.exit(1);
}

const buf = readFileSync(input);

/** Top-level atom walk. @returns {{type: string, start: number, end: number}[]} */
function topLevelAtoms() {
	const atoms = [];
	let pos = 0;
	while (pos + 8 <= buf.length) {
		let size = buf.readUInt32BE(pos);
		const type = buf.toString('latin1', pos + 4, pos + 8);
		let headerSize = 8;
		if (size === 1) {
			size = Number(buf.readBigUInt64BE(pos + 8));
			headerSize = 16;
		} else if (size === 0) {
			size = buf.length - pos; // "to end of file"
		}
		if (size < headerSize) throw new Error(`bad atom size ${size} for ${type} at ${pos}`);
		atoms.push({ type, start: pos, end: pos + size });
		pos += size;
	}
	return atoms;
}

// Atoms that contain other atoms and so must be descended into to reach stbl.
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'mdia']);

/**
 * Shifts every chunk offset in a standalone copy of the moov atom.
 * @param {Buffer} moov
 * @param {number} delta
 */
function shiftChunkOffsets(moov, delta) {
	let patched = 0;

	/** @param {number} start @param {number} end */
	function walk(start, end) {
		let pos = start;
		while (pos + 8 <= end) {
			let size = moov.readUInt32BE(pos);
			const type = moov.toString('latin1', pos + 4, pos + 8);
			let headerSize = 8;
			if (size === 1) {
				size = Number(moov.readBigUInt64BE(pos + 8));
				headerSize = 16;
			} else if (size === 0) {
				size = end - pos;
			}
			if (size < headerSize) throw new Error(`bad nested atom ${type}`);

			const body = pos + headerSize;

			if (type === 'stco') {
				const count = moov.readUInt32BE(body + 4); // after version/flags
				for (let i = 0; i < count; i++) {
					const at = body + 8 + i * 4;
					const shifted = moov.readUInt32BE(at) + delta;
					if (shifted > 0xffffffff) {
						throw new Error('offset overflows 32-bit stco; needs co64 rewrite');
					}
					moov.writeUInt32BE(shifted, at);
				}
				patched += count;
			} else if (type === 'co64') {
				const count = moov.readUInt32BE(body + 4);
				for (let i = 0; i < count; i++) {
					const at = body + 8 + i * 8;
					moov.writeBigUInt64BE(moov.readBigUInt64BE(at) + BigInt(delta), at);
				}
				patched += count;
			} else if (CONTAINERS.has(type)) {
				walk(body, pos + size);
			}

			pos += size;
		}
	}

	walk(8, moov.length); // skip the moov header itself
	return patched;
}

const atoms = topLevelAtoms();
const moovAtom = atoms.find((a) => a.type === 'moov');
const mdatAtom = atoms.find((a) => a.type === 'mdat');

if (!moovAtom) throw new Error('no moov atom found — not an MP4?');
if (!mdatAtom) throw new Error('no mdat atom found');

if (moovAtom.start < mdatAtom.start) {
	console.log(`${input}: moov already precedes mdat — already faststart, nothing to do.`);
	process.exit(0);
}

const moov = Buffer.from(buf.subarray(moovAtom.start, moovAtom.end)); // copy, then patch
const patched = shiftChunkOffsets(moov, moov.length);

// ftyp (and any other leading atoms) → moov → everything else, minus the old moov.
const head = [];
const tail = [];
for (const a of atoms) {
	if (a.type === 'moov') continue;
	(a.type === 'ftyp' ? head : tail).push(buf.subarray(a.start, a.end));
}

const out = Buffer.concat([...head, moov, ...tail]);

if (out.length !== buf.length) {
	throw new Error(`size changed (${buf.length} → ${out.length}); refusing to write`);
}

const dest = output ?? `${input}.faststart.tmp`;
writeFileSync(dest, out);
if (!output) renameSync(dest, input);

console.log(
	`${input}: moved moov (${moov.length.toLocaleString()} bytes) to the front, ` +
		`shifted ${patched} chunk offsets → ${output ?? input}`
);
