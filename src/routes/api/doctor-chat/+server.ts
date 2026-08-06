// Server-side proxy for "AI doctor" generation — the only generation path.
//
// Why this exists: the provider API keys must never reach the browser. The
// client posts the RAG prompt here; this endpoint adds a key server-side,
// enforces a per-provider daily request cap, calls the provider's
// OpenAI-compatible endpoint, and streams the answer back as plain text.
//
// Two providers, tried in order (see PROVIDERS). Both speak the same
// OpenAI-compatible wire format, so one code path drives both — they differ
// only in URL, model, key and token budget.
//
// Cost safety is layered:
//   1. HARD guarantee — both keys are created on accounts with NO billing
//      attached, so exceeding the free tier returns 429/402, never a charge.
//      Nothing here is load-bearing for that.
//   2. GRACEFUL cap — the Netlify Blobs counters below stop calling a provider
//      once its DAILY cap is reached, so visitors get a friendly "try again
//      tomorrow" message instead of a wall of 429s.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

interface ProviderSpec {
	id: string;
	url: string;
	model: string;
	/** Name of the env var holding the key. Absent key ⇒ provider skipped. */
	envKey: string;
	/** Completion budget. Reasoning models spend part of this before any
	 *  visible token, so they need considerably more than a plain chat model. */
	maxTokens: number;
	/** Requests/day before we stop calling this provider entirely. */
	dailyCap: number;
	/** Provider-specific request fields merged into the body. */
	extraBody?: Record<string, unknown>;
}

// Order matters: first entry is preferred, later entries are failover.
//
// Measured limits (from each vendor's x-ratelimit-* response headers), against
// a ~3.2k-token prompt:
//
//              per minute            per day        ⇒ effective
//   cerebras   5 req / 30k tokens    1M tokens        ~5 questions/min
//   groq       30 req / 6k tokens    14,400 req       ~1.5 questions/min
//
// Cerebras leads because throughput — not cost — is the binding constraint, and
// the two run out in opposite ways: Groq is starved by tokens-per-minute long
// before its 30 RPM matters, Cerebras by requests-per-minute while it still has
// token budget to spare. That is what makes them complement each other rather
// than just duplicate. gpt-oss-120b is also a much stronger model than
// llama-3.1-8b-instant, so when Cerebras answers it answers better.
const PROVIDERS: ProviderSpec[] = [
	{
		id: 'cerebras',
		url: 'https://api.cerebras.ai/v1/chat/completions',
		model: 'gpt-oss-120b',
		envKey: 'CEREBRAS_API_KEY',
		// gpt-oss is a reasoning model: `max_completion_tokens` covers the hidden
		// reasoning too, and we only forward `delta.content` to the browser. Too
		// small a budget here yields an EMPTY answer (all budget spent thinking)
		// rather than a truncated one, so keep the headroom and the low effort.
		maxTokens: 2000,
		// The 1M tokens/day ceiling binds long before the 2,400 requests/day one:
		// at ~5k tokens a question that is ~200 questions, not 2,400. This counter
		// is per-request, so it can only approximate a token budget — 180 keeps
		// headroom and hands the overflow to Groq rather than to a wall of 429s.
		dailyCap: 180,
		extraBody: { reasoning_effort: 'low' }
	},
	{
		id: 'groq',
		url: 'https://api.groq.com/openai/v1/chat/completions',
		model: 'llama-3.1-8b-instant',
		envKey: 'GROQ_API_KEY',
		maxTokens: 700,
		dailyCap: 1000
	}
];

interface ChatBody {
	system: string;
	messages: { role: 'user' | 'assistant'; content: string }[];
}

// ── circuit breaker ─────────────────────────────────────────────────
// A provider that answers 401/402/403 is misconfigured or out of quota at the
// ACCOUNT level — retrying it on every request just adds a wasted round-trip to
// every visitor's latency. Park it for a while instead. Module-level state
// lives as long as the warm serverless instance, which is exactly the right
// scope: it decays for free and never needs invalidating.
const COOLDOWN_MS = 10 * 60 * 1000;
const disabledUntil = new Map<string, number>();

function isCoolingDown(id: string): boolean {
	const until = disabledUntil.get(id);
	if (until === undefined) return false;
	if (Date.now() >= until) {
		disabledUntil.delete(id);
		return false;
	}
	return true;
}

// ── daily quota via Netlify Blobs (best-effort; fail-open) ──────────
// Counted per provider, and only for a provider we are actually about to call,
// so a failover does not burn quota against the provider that was skipped.
async function overDailyCap(spec: ProviderSpec): Promise<boolean> {
	try {
		const { getStore } = await import('@netlify/blobs');
		const store = getStore('doctor-usage');
		const key = `${spec.id}-${new Date().toISOString().slice(0, 10)}`; // id-YYYY-MM-DD
		const current = Number(await store.get(key)) || 0;
		if (current >= spec.dailyCap) return true;
		await store.set(key, String(current + 1));
		return false;
	} catch {
		// Blobs unavailable (e.g. local dev without Netlify context). Fail open —
		// the no-billing keys are the real cost guarantee, so a missing counter can
		// only affect UX, never spend.
		return false;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const configured = PROVIDERS.filter((p) => env[p.envKey]);
	if (configured.length === 0) {
		return json({ code: 'not_configured' }, { status: 503 });
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

	const messages = [{ role: 'system', content: body.system }, ...body.messages];

	// Remember why each provider fell through so the client can be told what
	// actually went wrong when every one of them does.
	let lastCode = 'provider_error';
	let lastStatus = 502;

	for (const spec of configured) {
		if (isCoolingDown(spec.id)) continue;

		if (await overDailyCap(spec)) {
			lastCode = 'daily_cap';
			lastStatus = 429;
			continue;
		}

		let resp: Response;
		try {
			resp = await fetch(spec.url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${env[spec.envKey]}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					model: spec.model,
					max_completion_tokens: spec.maxTokens,
					temperature: 0.3,
					stream: true,
					messages,
					...spec.extraBody
				})
			});
		} catch {
			// DNS/TLS/timeout — try the next provider.
			lastCode = 'provider_error';
			lastStatus = 502;
			continue;
		}

		// 401/402/403: account-level problem (bad key, no quota on the billing
		// account). Park this provider rather than paying for the round-trip on
		// every subsequent request.
		if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
			disabledUntil.set(spec.id, Date.now() + COOLDOWN_MS);
			lastCode = 'provider_error';
			lastStatus = 502;
			continue;
		}
		if (resp.status === 429) {
			// per-minute / token-per-minute limit — transient, and exactly the case
			// the second provider exists to absorb.
			lastCode = 'provider_rate';
			lastStatus = 429;
			continue;
		}
		if (!resp.ok || !resp.body) {
			lastCode = 'provider_error';
			lastStatus = 502;
			continue;
		}

		// Past this point we are committed: once the first byte is on the wire we
		// cannot fail over without the client having to discard a partial answer.
		// Failover is deliberately a pre-stream decision only.
		return streamPlainText(resp.body, spec.id);
	}

	return json({ code: lastCode, status: lastStatus }, { status: lastStatus });
};

/**
 * Transform an OpenAI-style SSE body into a plain-text delta stream the client
 * can read without SSE parsing. If Netlify buffers the response, it still
 * arrives correct — just all at once.
 *
 * Only `delta.content` is forwarded. Reasoning models also emit
 * `delta.reasoning`, which is the model's private scratchpad and must not be
 * shown as if it were the answer.
 */
function streamPlainText(source: ReadableStream<Uint8Array>, providerId: string): Response {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = '';

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const reader = source.getReader();
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
			'cache-control': 'no-store',
			// Which backend actually answered. Surfaced for the dev-only retrieval
			// log; harmless to expose (it names a vendor, not a key or a quota).
			'x-doctor-provider': providerId
		}
	});
}
