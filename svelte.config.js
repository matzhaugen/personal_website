import adapter from '@sveltejs/adapter-netlify';
import { mdsvex } from 'mdsvex'
import remarkFootnotes from 'remark-footnotes'


export default {
	extensions: ['.svelte', '.svx', '.md'],
	preprocess: mdsvex({ 
		remarkPlugins: [remarkFootnotes],
		extensions: ['.svx', '.md'] }),

		
	kit: {
		adapter: adapter(),
		target: '#svelte',
		vite: {
			mode: "production"
		}
	}

};
