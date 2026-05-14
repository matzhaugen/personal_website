// Adapter dispatch. Builds the right LLMAdapter for the user's currently
// selected provider. WebLLM is the default; the four BYOK providers each
// require a non-empty key.
import type { LLMAdapter, Settings } from '../types';
import { makeWebllmAdapter } from './webllm';
import { makeAnthropicAdapter } from './anthropic';
import { makeOpenAIAdapter } from './openai';
import { makeXaiAdapter } from './xai';
import { makeGeminiAdapter } from './gemini';

export class MissingApiKeyError extends Error {
	constructor(provider: string) {
		super(`No API key set for ${provider}. Open settings to add one, or switch to WebLLM.`);
		this.name = 'MissingApiKeyError';
	}
}

export function getAdapter(s: Settings): LLMAdapter {
	const model = s.models[s.provider];
	switch (s.provider) {
		case 'webllm':
			return makeWebllmAdapter(model);
		case 'anthropic':
			if (!s.keys.anthropic) throw new MissingApiKeyError('Anthropic');
			return makeAnthropicAdapter(s.keys.anthropic, model);
		case 'openai':
			if (!s.keys.openai) throw new MissingApiKeyError('OpenAI');
			return makeOpenAIAdapter(s.keys.openai, model);
		case 'xai':
			if (!s.keys.xai) throw new MissingApiKeyError('xAI');
			return makeXaiAdapter(s.keys.xai, model);
		case 'gemini':
			if (!s.keys.gemini) throw new MissingApiKeyError('Gemini');
			return makeGeminiAdapter(s.keys.gemini, model);
	}
}
