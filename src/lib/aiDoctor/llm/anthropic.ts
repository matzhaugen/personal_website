// Anthropic Messages API, called directly from the browser.
//
// Direct browser calls require the dangerous-direct-browser-access header
// (introduced 2024) — Anthropic's CORS allowlist gates on it specifically
// because the canonical setup proxies through a server.
import type { LLMAdapter, LLMAdapterStreamOpts } from '../types';
import { iterSse } from './_sse';

export function makeAnthropicAdapter(apiKey: string, model: string): LLMAdapter {
	return {
		id: 'anthropic',
		stream: (opts) => streamAnthropic(apiKey, model, opts)
	};
}

async function* streamAnthropic(
	apiKey: string,
	model: string,
	opts: LLMAdapterStreamOpts
): AsyncIterable<string> {
	if (!apiKey) throw new Error('Anthropic API key required');

	const r = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		signal: opts.abortSignal,
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model,
			system: opts.system,
			messages: opts.messages,
			max_tokens: opts.maxTokens ?? 2048,
			temperature: opts.temperature ?? 0.7,
			stream: true
		})
	});
	if (!r.ok || !r.body) {
		const body = await r.text().catch(() => '');
		throw new Error(`Anthropic ${r.status}: ${body || r.statusText}`);
	}

	for await (const ev of iterSse(r.body)) {
		if (ev.event !== 'content_block_delta') continue;
		try {
			const j = JSON.parse(ev.data);
			const text = j?.delta?.text;
			if (typeof text === 'string' && text.length) yield text;
		} catch {
			// ignore malformed event data
		}
	}
}
