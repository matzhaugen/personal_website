// Server-side proxy for the "AI doctor" Groq option.
//
// Why this exists: the Groq API key must never reach the browser. The client
// posts the RAG prompt here; this endpoint adds the key server-side, enforces a
// daily request cap (so we stay inside Groq's free tier gracefully), calls
// Groq's OpenAI-compatible endpoint, and streams the answer back as plain text.
//
// Cost safety is layered:
//   1. HARD guarantee — the GROQ_API_KEY is created on a Groq account with NO
//      billing attached, so exceeding the free tier returns HTTP 429, never a
//      charge. Nothing here is load-bearing for that.
//   2. GRACEFUL cap — the Netlify Blobs counter below stops calling Groq once
//      DAILY_CAP is reached and tells the client to fall back to WebLLM, so
//      visitors get a friendly message instead of a wall of 429s.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Groq free tier (llama-3.1-8b-instant): 30 RPM, 6k TPM, 14,400 RPD. We cap
// well under the daily ceiling; Groq's own 429s cover the per-minute limits.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const DAILY_CAP = 1000; // requests/day before we shed load to WebLLM
const MAX_TOKENS = 700;

interface ChatBody {
	system: string;
	messages: { role: 'user' | 'assistant'; content: string }[];
}

// ── daily quota via Netlify Blobs (best-effort; fail-open) ──────────
async function overDailyCap(): Promise<boolean> {
	try {
		const { getStore } = await import('@netlify/blobs');
		const store = getStore('doctor-usage');
		const key = `groq-${new Date().toISOString().slice(0, 10)}`; // groq-YYYY-MM-DD
		const current = Number(await store.get(key)) || 0;
		if (current >= DAILY_CAP) return true;
		await store.set(key, String(current + 1));
		return false;
	} catch {
		// Blobs unavailable (e.g. local dev without Netlify context). Fail open —
		// the no-billing key is the real cost guarantee, so a missing counter can
		// only affect UX, never spend.
		return false;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.GROQ_API_KEY;
	if (!apiKey) {
		return json({ code: 'not_configured' }, { status: 503 });
	}

	if (await overDailyCap()) {
		return json({ code: 'daily_cap' }, { status: 429 });
	}

	let body: ChatBody;
	try {
		body = await request.json();
	} catch {
		return json({ code: 'bad_request' }, { status: 400 });
	}
	if (!body?.messages?.length) {
		return json({ code: 'bad_request' }, { status: 400 });
	}

	const groqResp = await fetch(GROQ_URL, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${apiKey}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: GROQ_MODEL,
			max_tokens: MAX_TOKENS,
			temperature: 0.3,
			stream: true,
			messages: [{ role: 'system', content: body.system }, ...body.messages]
		})
	});

	if (groqResp.status === 429) {
		// per-minute / token-per-minute limit — transient, client suggests retry
		return json({ code: 'provider_rate' }, { status: 429 });
	}
	if (!groqResp.ok || !groqResp.body) {
		return json({ code: 'provider_error', status: groqResp.status }, { status: 502 });
	}

	// Transform Groq's OpenAI-style SSE into a plain-text delta stream the client
	// can read without SSE parsing. If Netlify buffers the response, it still
	// arrives correct — just all at once.
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = '';

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const reader = groqResp.body!.getReader();
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? ''; // keep partial line
					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed.startsWith('data:')) continue;
						const data = trimmed.slice(5).trim();
						if (data === '[DONE]') continue;
						try {
							const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
							if (delta) controller.enqueue(encoder.encode(delta));
						} catch {
							// ignore keep-alive / non-JSON lines
						}
					}
				}
			} catch (err) {
				controller.error(err);
				return;
			}
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
