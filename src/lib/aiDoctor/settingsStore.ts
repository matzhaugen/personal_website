// Provider/model settings, persisted to localStorage. Generation runs fully
// in-browser via WebLLM — there is no server and no API key in the loop.
import { writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type Settings } from './types';

const KEY = 'ai_doctor_settings';

function load(): Settings {
	if (typeof window === 'undefined') return DEFAULT_SETTINGS;
	const raw = localStorage.getItem(KEY);
	if (!raw) return DEFAULT_SETTINGS;
	try {
		const parsed = JSON.parse(raw) as Partial<Settings>;
		// Shallow merge so older/newer builds tolerate each other's stored shape.
		// Guard the provider against stale/unknown values from older builds.
		const provider =
			parsed.provider === 'webllm' || parsed.provider === 'groq'
				? parsed.provider
				: DEFAULT_SETTINGS.provider;
		return {
			provider,
			models: { ...DEFAULT_SETTINGS.models, ...(parsed.models ?? {}) }
		};
	} catch {
		return DEFAULT_SETTINGS;
	}
}

export const settings = writable<Settings>(load());

if (typeof window !== 'undefined') {
	settings.subscribe((v) => {
		localStorage.setItem(KEY, JSON.stringify(v));
	});
}
