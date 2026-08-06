// Hosted-model adapter — talks to our own /api/doctor-chat endpoint, which
// holds the provider API keys server-side and picks a backend (Cerebras, then
// Groq as failover). Which one served a given answer is a server-side decision
// this adapter deliberately knows nothing about beyond the response header it
// reports back for logging.
//
// The endpoint streams back plain-text deltas (not SSE), so we just decode and
// yield chunks. Errors are surfaced as typed exceptions the chat UI maps to
// friendly messages.
import type { LLMAdapter, LLMAdapterStreamOpts } from '../types';

export class HostedModelError extends Error {
	code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = 'HostedModelError';
		this.code = code;
	}
}

// Codes are set by /api/doctor-chat and describe the state AFTER every
// configured provider has been tried, so "rate limit" here means all of them
// were rate-limited, not just the first.
const MESSAGES: Record<string, string> = {
	not_configured: 'The model isn’t configured on the server yet. Please try again later.',
	daily_cap:
		'The AI doctor has hit its daily free-tier limit. Please try again tomorrow — search still works, but answers are paused until the quota resets.',
	provider_rate:
		'The model is busy right now (rate limit). Wait a few seconds and send your question again.',
	provider_error: 'The hosted model had a server error. Please try again shortly.',
	bad_request: 'Something went wrong building the request. Please try again.'
};

export function makeHostedAdapter(): LLMAdapter {
	return {
		id: 'hosted',
		async *stream(opts: LLMAdapterStreamOpts) {
			let resp: Response;
			try {
				resp = await fetch('/api/doctor-chat', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ system: opts.system, messages: opts.messages }),
					signal: opts.abortSignal
				});
			} catch (err) {
				if ((err as Error)?.name === 'AbortError') return;
				throw new HostedModelError(
					'network',
					'Could not reach the hosted model. Check your connection and try again.'
				);
			}

			if (!resp.ok || !resp.body) {
				let code = 'provider_error';
				try {
					code = (await resp.json())?.code ?? code;
				} catch {
					/* non-JSON error body */
				}
				throw new HostedModelError(code, MESSAGES[code] ?? MESSAGES.provider_error);
			}

			opts.onProvider?.(resp.headers.get('x-doctor-provider') ?? 'unknown');

			const reader = resp.body.getReader();
			const decoder = new TextDecoder();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				if (opts.abortSignal?.aborted) {
					await reader.cancel();
					return;
				}
				const text = decoder.decode(value, { stream: true });
				if (text) yield text;
			}
		}
	};
}
