// One-bit "I read the disclaimer" flag. Mirrors src/lib/authStore.ts —
// localStorage-backed writable so the gate sticks across reloads.
import { writable } from 'svelte/store';

const KEY = 'ai_doctor_disclaimer';

const initial =
	typeof window !== 'undefined' ? localStorage.getItem(KEY) === 'true' : false;

export const disclaimerAccepted = writable(initial);

if (typeof window !== 'undefined') {
	disclaimerAccepted.subscribe((v) => {
		if (v) localStorage.setItem(KEY, 'true');
		else localStorage.removeItem(KEY);
	});
}
