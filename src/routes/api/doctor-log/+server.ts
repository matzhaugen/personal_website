// Dev-only retrieval log, for tuning the thresholds in retrieval.ts against
// real questions instead of hand-built cases.
//
// This exists ONLY when `npm run dev` is running on your own machine. In a
// production build `dev` is false and this route 404s, so nothing a visitor
// types is ever written anywhere — which is what keeps the promise in
// AiDoctorDisclaimer ("they aren't stored on my servers") literally true.
// If you ever want this in production, change the disclaimer first.
import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Repo-root-relative; gitignored. */
const LOG_FILE = 'doctor-queries.jsonl';

export const POST: RequestHandler = async ({ request }) => {
	if (!dev) return new Response('Not found', { status: 404 });

	let entry: unknown;
	try {
		entry = await request.json();
	} catch {
		return json({ ok: false }, { status: 400 });
	}

	// Imported lazily so the production bundle never pulls node:fs in for a
	// route that can't run there anyway.
	const { appendFile } = await import('node:fs/promises');
	const line = JSON.stringify({ ts: new Date().toISOString(), ...(entry as object) });
	await appendFile(LOG_FILE, line + '\n', 'utf8');

	return json({ ok: true });
};
