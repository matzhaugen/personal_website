// Chat history, persisted to localStorage as a single JSON array. Capped at
// MAX_MESSAGES so a long-running conversation never overflows the 5–10 MB
// localStorage budget.
import { writable } from 'svelte/store';
import type { ChatMessage } from './types';

const KEY = 'ai_doctor_chat';
const MAX_MESSAGES = 200;

function load(): ChatMessage[] {
	if (typeof window === 'undefined') return [];
	const raw = localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const messages = writable<ChatMessage[]>(load());

export function appendMessage(m: ChatMessage) {
	messages.update((cur) => {
		const next = [...cur, m];
		return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
	});
}

// Replace the last assistant message — used while streaming so the UI can
// update token-by-token without losing the sources block.
export function updateLastAssistant(content: string) {
	messages.update((cur) => {
		const next = [...cur];
		for (let i = next.length - 1; i >= 0; i--) {
			if (next[i].role === 'assistant') {
				next[i] = { ...next[i], content };
				break;
			}
		}
		return next;
	});
}

export function clearChat() {
	messages.set([]);
}

if (typeof window !== 'undefined') {
	messages.subscribe((v) => {
		localStorage.setItem(KEY, JSON.stringify(v));
	});
}
