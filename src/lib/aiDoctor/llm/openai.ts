// OpenAI Chat Completions API, called directly from the browser.
// Same SSE shape is used by xAI Grok (OpenAI-compatible endpoint).
import type { LLMAdapter, LLMAdapterStreamOpts, ProviderId } from '../types';
import { iterSse } from './_sse';

export function makeOpenAICompatibleAdapter(
	id: ProviderId,
	endpoint: string,
	apiKey: string,
	model: string
): LLMAdapter {
	return {
		id,
		stream: (opts) => streamOpenAI(endpoint, apiKey, model, opts)
	};
}

export function makeOpenAIAdapter(apiKey: string, model: string): LLMAdapter {
	return makeOpenAICompatibleAdapter(
		'openai',
		'https://api.openai.com/v1/chat/completions',
		apiKey,
		model
	);
}

async function* streamOpenAI(
	endpoint: string,
	apiKey: string,
	model: string,
	opts: LLMAdapterStreamOpts
): AsyncIterable<string> {
	if (!apiKey) throw new Error('API key required');

	const messages = [
		{ role: 'system', content: opts.system },
		...opts.messages
	];

	const r = await fetch(endpoint, {
		method: 'POST',
		signal: opts.abortSignal,
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages,
			temperature: opts.temperature ?? 0.7,
			max_tokens: opts.maxTokens ?? 2048,
			stream: true
		})
	});
	if (!r.ok || !r.body) {
		const body = await r.text().catch(() => '');
		throw new Error(`${endpoint} ${r.status}: ${body || r.statusText}`);
	}

	for await (const ev of iterSse(r.body)) {
		if (ev.data === '[DONE]') return;
		try {
			const j = JSON.parse(ev.data);
			const text = j?.choices?.[0]?.delta?.content;
			if (typeof text === 'string' && text.length) yield text;
		} catch {
			// ignore
		}
	}
}
