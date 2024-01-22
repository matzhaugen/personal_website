import { redirect } from '@sveltejs/kit';

export function load() {
	redirect(308, 'https://c19injury.com');
}