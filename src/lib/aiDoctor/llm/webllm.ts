// WebLLM adapter — runs Llama-3.2-3B / Phi-3.5-mini / etc. directly in the
// browser via WebGPU. Weights download once (~1–2 GB) and cache in OPFS, so
// repeat visits skip the download.
//
// This is the privacy-preserving default: the prompt and answer never leave
// the device. Requires WebGPU; falls back to a typed error on Firefox /
// older Safari which the chat UI catches and surfaces.
import type { LLMAdapter, LLMAdapterStreamOpts } from '../types';

// Engines are keyed by model id and reused across calls so the (slow) load
// path runs once per session per model.
const engineCache = new Map<string, Promise<unknown>>();

export class WebGpuUnsupportedError extends Error {
	constructor() {
		super('WebGPU is not available in this browser. Use Chrome, Edge, or Safari 26+ to run the in-browser model.');
		this.name = 'WebGpuUnsupportedError';
	}
}

function checkWebGpu() {
	if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
		throw new WebGpuUnsupportedError();
	}
}

async function getEngine(modelId: string, onProgress?: LLMAdapterStreamOpts['onProgress']) {
	checkWebGpu();
	let p = engineCache.get(modelId);
	if (!p) {
		p = (async () => {
			const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
			return CreateMLCEngine(modelId, {
				initProgressCallback: (rep: { progress: number; text: string }) => {
					// rep.progress is 0..1 across the full load (download +
					// shader compilation). Pass through as 0..100.
					if (onProgress) onProgress(Math.round(rep.progress * 100), 100, rep.text || 'webllm');
				}
			});
		})();
		engineCache.set(modelId, p);
	}
	return p;
}

export function makeWebllmAdapter(modelId: string): LLMAdapter {
	return {
		id: 'webllm',
		async *stream(opts: LLMAdapterStreamOpts) {
			const engine = (await getEngine(modelId, opts.onProgress)) as {
				chat: { completions: { create: (req: unknown) => Promise<AsyncIterable<{ choices?: { delta?: { content?: string } }[] }>> } };
			};

			const messages = [
				{ role: 'system', content: opts.system },
				...opts.messages
			];

			const stream = await engine.chat.completions.create({
				messages,
				stream: true,
				temperature: opts.temperature ?? 0.7,
				max_tokens: opts.maxTokens ?? 2048
			});

			for await (const chunk of stream) {
				if (opts.abortSignal?.aborted) return;
				const text = chunk?.choices?.[0]?.delta?.content;
				if (typeof text === 'string' && text.length) yield text;
			}
		}
	};
}
