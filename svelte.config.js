import adapter from '@sveltejs/adapter-netlify';
import path from 'path'
import { mdsvex } from 'mdsvex'

export default {
	extensions: ['.svelte', '.svx', '.md'],
	preprocess: mdsvex({ 
		extensions: ['.svx', '.md'] }),

		
	kit: {
		adapter: adapter(),
		target: '#svelte',
		vite: {
			mode: "production"
		}
	}

};
