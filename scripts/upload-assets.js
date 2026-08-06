/**
 * Uploads static assets to the DigitalOcean Space `stackmap`, which fronts the
 * site's large binary payloads: blog figures/videos and the AI Doctor retrieval
 * index. Anything under static/ that is too big to live in git goes here, and
 * VITE_ASSET_BASE (set in netlify.toml) points the app at the CDN in production.
 *
 * Object keys mirror the path relative to static/, so static/ai-doctor/foo.bin
 * lands at ai-doctor/foo.bin and resolves as $VITE_ASSET_BASE/ai-doctor/foo.bin —
 * exactly what src/lib/aiDoctor/assets.ts builds.
 *
 * Credentials come from the environment (or .env), never from code:
 *     DO_ACCESS_KEY   — Spaces access key id
 *     DO_SECRET_KEY   — Spaces secret access key
 * On this machine they are exported from ~/.bash_profile, so no .env is needed.
 *
 * manifest.json is always uploaded LAST. The browser version-checks it before
 * parsing any binary (manifest.ts), so publishing it first would give anyone
 * loading the page mid-upload a new manifest describing data that is still the
 * old layout — which parses without error and scores nonsense.
 *
 * Usage:
 *     npm run assets                       # upload static/ai-doctor
 *     npm run assets -- --dry-run          # show what would change, upload nothing
 *     npm run assets -- --force            # re-upload even if unchanged
 *     npm run assets -- static/media       # upload some other subtree of static/
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	S3Client,
	PutObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(REPO_ROOT, 'static');

const BUCKET = 'stackmap';
const REGION = 'sfo3';
const ENDPOINT = 'https://sfo3.digitaloceanspaces.com';
// Everything but the manifest is requested with `?v=<build_timestamp>` (see
// src/lib/aiDoctor/assets.ts), so a rebuilt index lands on fresh URLs and a long
// TTL is free. The manifest is the pointer that carries that timestamp, so it
// can't be versioned that way and must expire quickly instead.
//
// This is not hypothetical: on 2026-08-06 all five binaries refreshed while the
// edge kept serving a nine-month-old manifest (schema_version 1) for another 16
// hours, because re-uploading an object does NOT evict a cached edge copy that
// is still inside its TTL. The client version-check turned that into a hard
// error rather than corruption, but /doctor was down until it was worked around.
const CACHE_CONTROL = 'public, max-age=86400';
const CACHE_CONTROL_MANIFEST = 'public, max-age=60';

function cacheControlFor(file) {
	return path.basename(file) === 'manifest.json' ? CACHE_CONTROL_MANIFEST : CACHE_CONTROL;
}

const DEFAULT_DIRS = ['static/ai-doctor'];

// Files we never want to publish — macOS/editor cruft.
const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

// The CDN gzips text types on the fly; binaries are served raw. Getting these
// right matters: a .bin served as text/html would be mangled by the CDN.
const CONTENT_TYPES = {
	'.json': 'application/json',
	'.bin': 'application/octet-stream',
	'.i8': 'application/octet-stream',
	'.f32': 'application/octet-stream',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.pdf': 'application/pdf',
	'.csv': 'text/csv',
	'.txt': 'text/plain',
	'.js': 'text/javascript'
};

function contentTypeFor(file) {
	return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// Files that must be stored byte-for-byte, because something reads them with
// HTTP Range requests. A gzip-encoded object serves ranges over the COMPRESSED
// representation, so every byte offset silently points at the wrong place —
// chunks.ts would decode garbage rather than fail. Never add a range-read file
// to the compressible set.
const NEVER_COMPRESS = new Set(['chunks-text.bin']);

// Already-compressed formats gain nothing and cost CPU on every request.
const PRECOMPRESSED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.mp4', '.webm']);

/**
 * The Space stores exactly what we send. DigitalOcean's CDN auto-gzips text
 * content types on the fly but leaves application/octet-stream alone, so the
 * binary index files — which are where the bandwidth actually is — would ship
 * uncompressed unless we compress them ourselves. bm25.bin in particular is
 * 41.65 MB raw and 10.54 MB gzipped, because its doc ids are delta-coded so the
 * high bytes are all zeros.
 */
function shouldCompress(file) {
	const base = path.basename(file);
	if (NEVER_COMPRESS.has(base)) return false;
	return !PRECOMPRESSED.has(path.extname(file).toLowerCase());
}

function formatSize(bytes) {
	return bytes >= 1_000_000
		? `${(bytes / 1_000_000).toFixed(2)} MB`
		: `${(bytes / 1_000).toFixed(1)} kB`;
}

/** Every file under `dir`, recursively, as absolute paths. */
function walk(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_NAMES.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else if (entry.isFile()) out.push(full);
	}
	return out;
}

/**
 * Whether the remote object already matches the local file. Spaces returns the
 * MD5 as the ETag for single-part uploads, which is what we always do here, so
 * comparing it is exact. A missing object (404) counts as changed.
 */
async function isUnchanged(s3, key, body) {
	try {
		const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
		const remoteEtag = (head.ETag ?? '').replaceAll('"', '');
		// Multipart ETags carry a "-<partcount>" suffix and aren't an MD5 of the
		// whole object; treat those as changed rather than guessing.
		if (remoteEtag.includes('-')) return false;
		return remoteEtag === crypto.createHash('md5').update(body).digest('hex');
	} catch (err) {
		if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return false;
		throw err;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const force = args.includes('--force');
	const dirArgs = args.filter((a) => !a.startsWith('--'));
	const dirs = dirArgs.length > 0 ? dirArgs : DEFAULT_DIRS;

	// Node 22 loads .env natively; absent or unreadable is fine when the
	// credentials already live in the environment (CI, exported shell vars).
	try {
		process.loadEnvFile(path.join(REPO_ROOT, '.env'));
	} catch {
		/* no .env — fall through to process.env */
	}

	const accessKeyId = process.env.DO_ACCESS_KEY;
	const secretAccessKey = process.env.DO_SECRET_KEY;
	if (!accessKeyId || !secretAccessKey) {
		console.error(
			'DO_ACCESS_KEY and DO_SECRET_KEY are required (set them in .env — see .env.example).\n' +
				'Create a key pair under API > Spaces Keys in the DigitalOcean control panel.'
		);
		process.exit(1);
	}

	const files = [];
	for (const dir of dirs) {
		const abs = path.resolve(REPO_ROOT, dir);
		if (!fs.existsSync(abs)) {
			console.error(
				`${dir} does not exist.\n` +
					'For the AI Doctor index, build it first:\n' +
					'  cd ~/rag/rag-pipeline && uv run python scripts/export_for_web.py'
			);
			process.exit(1);
		}
		if (!abs.startsWith(STATIC_DIR + path.sep)) {
			console.error(`${dir} is not under static/ — object keys are derived from that path.`);
			process.exit(1);
		}
		files.push(...walk(abs));
	}

	if (files.length === 0) {
		console.error(`no files found under ${dirs.join(', ')}`);
		process.exit(1);
	}

	const s3 = new S3Client({
		region: REGION,
		endpoint: ENDPOINT,
		credentials: { accessKeyId, secretAccessKey }
	});

	console.log(`${dryRun ? '[dry run] ' : ''}uploading to ${BUCKET} (${REGION})\n`);

	let uploaded = 0;
	let skipped = 0;
	let bytes = 0;

	// Data first, manifest last — see the header note. Alphabetical order happens
	// to do this for the current filenames, but that must not be load-bearing.
	const ordered = files
		.sort()
		.sort((a, b) => Number(path.basename(a) === 'manifest.json') - Number(path.basename(b) === 'manifest.json'));

	for (const file of ordered) {
		const key = path.relative(STATIC_DIR, file).split(path.sep).join('/');
		const raw = fs.readFileSync(file);

		const gzipped = shouldCompress(file);
		const body = gzipped ? zlib.gzipSync(raw, { level: 9 }) : raw;
		const note = gzipped
			? `${formatSize(raw.byteLength)} → ${formatSize(body.byteLength)} gz`
			: `${formatSize(raw.byteLength)} raw`;

		if (!force && (await isUnchanged(s3, key, body))) {
			console.log(`  = ${key.padEnd(30)} ${note.padStart(22)}  (unchanged)`);
			skipped++;
			continue;
		}

		if (dryRun) {
			console.log(`  ↑ ${key.padEnd(30)} ${note.padStart(22)}  (would upload)`);
		} else {
			await s3.send(
				new PutObjectCommand({
					Bucket: BUCKET,
					Key: key,
					Body: body,
					ContentType: contentTypeFor(file),
					// Browsers decode this transparently in fetch(); the byte
					// offsets chunks.ts uses are why chunks-text.bin is exempt.
					...(gzipped ? { ContentEncoding: 'gzip' } : {}),
					CacheControl: cacheControlFor(file),
					ACL: 'public-read'
				})
			);
			console.log(`  ↑ ${key.padEnd(30)} ${note.padStart(22)}`);
		}
		uploaded++;
		bytes += body.byteLength;
	}

	console.log(
		`\n${dryRun ? 'would upload' : 'uploaded'} ${uploaded} file(s), ` +
			`${formatSize(bytes)}; ${skipped} unchanged`
	);

	await reportOrphans(s3, dirs, files);
}

/**
 * Objects on the Space with no local counterpart — typically a previous index
 * schema whose filenames changed (v1's embeddings.bin/chunks.json/bm25.json).
 * They cost storage and confuse the next person reading the bucket, but they
 * are not served once manifest.json points at the new layout. Reported, never
 * deleted: removing published data is not something a build script should
 * decide on its own.
 */
async function reportOrphans(s3, dirs, localFiles) {
	const local = new Set(localFiles.map((f) => path.relative(STATIC_DIR, f).split(path.sep).join('/')));
	const prefixes = [...new Set(dirs.map((d) => path.relative(STATIC_DIR, path.resolve(REPO_ROOT, d)) + '/'))];

	const orphans = [];
	for (const prefix of prefixes) {
		let token;
		do {
			const page = await s3.send(
				new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
			);
			for (const obj of page.Contents ?? []) {
				if (!obj.Key.endsWith('/') && !local.has(obj.Key)) {
					orphans.push([obj.Key, obj.Size ?? 0]);
				}
			}
			token = page.IsTruncated ? page.NextContinuationToken : undefined;
		} while (token);
	}

	if (orphans.length === 0) return;
	const total = orphans.reduce((t, [, size]) => t + size, 0);
	console.log(`\nremote objects with no local file (${formatSize(total)}):`);
	for (const [key, size] of orphans) {
		console.log(`  ? ${key.padEnd(34)} ${formatSize(size).padStart(10)}`);
	}
	console.log('  delete them from the DigitalOcean control panel if they are a retired index.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
