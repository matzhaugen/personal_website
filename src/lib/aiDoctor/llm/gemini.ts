// Google Gemini streamGenerateContent endpoint, called directly from the
// browser. Uses ?alt=sse to opt into Server-Sent Events (the default JSON
// streaming format is harder to parse incrementally).
import type { LLMAdapter, LLMAdapterStreamOpts } from '../types';
import { iterSse } from './_sse';

export function makeGeminiAdapter(apiKey: string, model: string): LLMAdapter {
	return {
		id: 'gemini',
		stream: (opts) => streamGemini(apiKey, model, opts)
	};
}

async function* streamGemini(
	apiKey: string,
	model: string,
	opts: LLMAdapterStreamOpts
): AsyncIterable<string> {
	if (!apiKey) throw new Error('Gemini API key required');

	// Gemini's content array has no system role — system instructions go in a
	// separate top-level `systemInstruction` field. User/assistant roles are
	// renamed to user/model.
	const contents = opts.messages.map((m) => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const url =
		`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent` +
		`?alt=sse&key=${encodeURIComponent(apiKey)}`;

	const r = await fetch(url, {
		method: 'POST',
		signal: opts.abortSignal,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: opts.system }] },
			contents,
			generationConfig: {
				temperature: opts.temperature ?? 0.7,
				maxOutputTokens: opts.maxTokens ?? 2048
			}
		})
	});
	if (!r.ok || !r.body) {
		const body = await r.text().catch(() => '');
		throw new Error(`Gemini ${r.status}: ${body || r.statusText}`);
	}

	for await (const ev of iterSse(r.body)) {
		try {
			const j = JSON.parse(ev.data);
			const parts = j?.candidates?.[0]?.content?.parts;
			if (Array.isArray(parts)) {
				for (const p of parts) {
					if (typeof p?.text === 'string' && p.text.length) yield p.text;
				}
			}
		} catch {
			// ignore
		}
	}
}
