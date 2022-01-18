import adapter from '@sveltejs/adapter-netlify';
import path from 'path'
import { mdsvex } from 'mdsvex'
import remarkGfm from 'remark-gfm'
import github from 'remark-github'

export default {
	extensions: ['.svelte', '.svx', '.md'],
	preprocess: mdsvex({ 
		remarkPlugins: [remarkGfm, github],
		extensions: ['.svx', '.md'] }),

		
	kit: {
		adapter: adapter(),
		target: '#svelte',
		vite: {
			mode: "production"
		}
	}

};
