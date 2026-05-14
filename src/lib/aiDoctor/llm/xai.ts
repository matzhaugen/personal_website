// xAI Grok — OpenAI-compatible Chat Completions API at api.x.ai/v1.
// Reuses the OpenAI streaming adapter under a different endpoint + id.
import type { LLMAdapter } from '../types';
import { makeOpenAICompatibleAdapter } from './openai';

export function makeXaiAdapter(apiKey: string, model: string): LLMAdapter {
	return makeOpenAICompatibleAdapter(
		'xai',
		'https://api.x.ai/v1/chat/completions',
		apiKey,
		model
	);
}
