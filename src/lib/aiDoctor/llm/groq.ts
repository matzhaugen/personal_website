// Groq adapter — talks to our own /api/doctor-chat endpoint, which holds the
// Groq API key server-side. The endpoint streams back plain-text deltas (not
// SSE), so we just decode and yield chunks. Errors are surfaced as typed
// exceptions the chat UI maps to friendly messages.
import type { LLMAdapter, LLMAdapterStreamOpts } from '../types';

export class GroqUnavailableError extends Error {
	code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = 'GroqUnavailableError';
		this.code = code;
	}
}

const MESSAGES: Record<string, string> = {
	not_configured:
		'The hosted model isn’t configured on the server yet. Switch to the in-browser model (WebLLM) in ⚙ Settings.',
	daily_cap:
		'The hosted model has hit its daily free-tier limit. Try again tomorrow, or switch to the in-browser model (WebLLM) in ⚙ Settings.',
	provider_rate:
		'The hosted model is busy right now (rate limit). Wait a few seconds and try again, or switch to the in-browser model (WebLLM) in ⚙ Settings.',
	provider_error: 'The hosted model had a server error. Please try again shortly.',
	bad_request: 'Something went wrong building the request. Please try again.'
};

export function makeGroqAdapter(): LLMAdapter {
	return {
		id: 'groq',
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
				throw new GroqUnavailableError('network', 'Could not reach the hosted model. Check your connection and try again.');
			}

			if (!resp.ok || !resp.body) {
				let code = 'provider_error';
				try {
					code = (await resp.json())?.code ?? code;
				} catch {
					/* non-JSON error body */
				}
				throw new GroqUnavailableError(code, MESSAGES[code] ?? MESSAGES.provider_error);
			}

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
