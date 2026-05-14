// Provider/model/key settings, persisted to localStorage. Keys never leave
// this store — there is no server in the loop.
import { writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type Settings } from './types';

const KEY = 'ai_doctor_settings';

function load(): Settings {
	if (typeof window === 'undefined') return DEFAULT_SETTINGS;
	const raw = localStorage.getItem(KEY);
	if (!raw) return DEFAULT_SETTINGS;
	try {
		const parsed = JSON.parse(raw) as Partial<Settings>;
		// Shallow merge so a newer build that adds a provider doesn't blow up
		// on settings written by an older build.
		return {
			provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
			models: { ...DEFAULT_SETTINGS.models, ...(parsed.models ?? {}) },
			keys: { ...DEFAULT_SETTINGS.keys, ...(parsed.keys ?? {}) }
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
