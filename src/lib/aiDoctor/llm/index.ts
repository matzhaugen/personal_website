// Adapter entry point. One client-side backend: the hosted models proxied
// through /api/doctor-chat, which holds the keys server-side and rotates
// between providers (Cerebras, then Groq) on rate limits.
import type { LLMAdapter } from '../types';
import { makeHostedAdapter } from './hosted';

export function getAdapter(): LLMAdapter {
	return makeHostedAdapter();
}

export { HostedModelError } from './hosted';
