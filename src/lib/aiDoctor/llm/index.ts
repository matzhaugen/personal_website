// Adapter dispatch. Two backends: in-browser WebLLM (WebGPU) or hosted Groq
// (proxied through /api/doctor-chat with the key server-side).
import type { LLMAdapter, Settings } from '../types';
import { makeWebllmAdapter } from './webllm';
import { makeGroqAdapter } from './groq';

export function getAdapter(s: Settings): LLMAdapter {
	if (s.provider === 'groq') return makeGroqAdapter();
	return makeWebllmAdapter(s.models.webllm);
}

export { GroqUnavailableError } from './groq';
