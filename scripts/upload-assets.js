#!/usr/bin/env node
/**
 * Syncs blog media (figures, videos) from /static to the DigitalOcean Space
 * `stackmap`, so the repo doesn't have to carry them and Netlify doesn't have
 * to serve them.
 *
 * Keys mirror the local paths exactly — static/covid-mortality/foo.svg becomes
 * <cdn>/covid-mortality/foo.svg — so switching between local and CDN is only a
 * matter of prefixing an origin (see VITE_ASSET_BASE in the figure components).
 *
 * Credentials come from the DO_ACCESS_KEY / DO_SECRET_KEY environment
 * variables; nothing is read from or written to a file in the repo.
 *
 * Requires the AWS CLI (Spaces is S3-compatible):  brew install awscli
 *
 * Usage:
 *   npm run assets                     # sync every media directory
 *   npm run assets -- covid-mortality  # just one
 *   npm run assets -- --delete         # also remove remote files gone locally
 *   npm run assets -- --dry-run        # show what would change
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	sha256,
	listMedia,
	loadManifest,
	saveManifest,
	MEDIA_DIRS,
	STATIC_DIR
} from './media-lib.js';

const BUCKET = 'stackmap';
const REGION = 'sfo3';
const ENDPOINT = `https://${REGION}.digitaloceanspaces.com`;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const withDelete = args.includes('--delete');
const only = args.filter((a) => !a.startsWith('--'));

const { DO_ACCESS_KEY, DO_SECRET_KEY } = process.env;
if (!DO_ACCESS_KEY || !DO_SECRET_KEY) {
	console.error('DO_ACCESS_KEY and DO_SECRET_KEY must be set in the environment.');
	process.exit(1);
}

try {
	execFileSync('aws', ['--version'], { stdio: 'ignore' });
} catch {
	console.error('aws CLI not found. Install it with:  brew install awscli');
	process.exit(1);
}

const env = {
	...process.env,
	AWS_ACCESS_KEY_ID: DO_ACCESS_KEY,
	AWS_SECRET_ACCESS_KEY: DO_SECRET_KEY,
	// Stop the CLI probing EC2 metadata when creds look unusual — it just hangs.
	AWS_EC2_METADATA_DISABLED: 'true'
};

const dirs = only.length ? only : MEDIA_DIRS;
let synced = 0;

for (const dir of dirs) {
	const local = join(STATIC_DIR, dir);
	if (!existsSync(local)) {
		console.warn(`  skipping ${dir} — no such directory under static/`);
		continue;
	}

	const cmd = [
		's3', 'sync', local, `s3://${BUCKET}/${dir}`,
		'--endpoint-url', ENDPOINT,
		'--region', REGION,
		'--acl', 'public-read',
		// Filenames are stable across re-exports, so a long TTL would serve stale
		// figures after a regenerate. A day is a reasonable compromise.
		'--cache-control', 'public, max-age=86400',
		'--exclude', '.DS_Store',
		'--no-progress'
	];
	if (withDelete) cmd.push('--delete');
	if (dryRun) cmd.push('--dryrun');

	console.log(`\n${dir}:`);
	const out = execFileSync('aws', cmd, { env, encoding: 'utf8' });
	const lines = out.trim().split('\n').filter(Boolean);
	for (const line of lines) console.log(`  ${line.replace(local, `static/${dir}`)}`);
	if (lines.length === 0) console.log('  already up to date');
	synced += lines.length;
}

// Record what is now on the remote, so `npm run publish -- --check` can tell
// whether local media has drifted since the last upload without a network call.
if (!dryRun) {
	const manifest = loadManifest();
	for (const key of listMedia(dirs)) {
		manifest.uploaded[key] = sha256(join(STATIC_DIR, key));
	}
	saveManifest(manifest);
}

console.log(
	`\n${dryRun ? '[dry run] ' : ''}${synced} object(s) ${dryRun ? 'would change' : 'uploaded'}.`
);
console.log(`Public base: https://${BUCKET}.${REGION}.cdn.digitaloceanspaces.com`);
