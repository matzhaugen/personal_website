
import adapter from '@sveltejs/adapter-netlify';
import { mdsvex } from 'mdsvex'
import remarkGfm from 'remark-gfm'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.svx', '.md'],
	preprocess: mdsvex({ 
		// remarkPlugins: [[remarkFootnotes, {inlineNotes: true}]],
		remarkPlugins: [[remarkGfm]],
		extensions: ['.svx', '.md'],
		layout: "./src/routes/blog/layout.svelte",
	}),
		
	kit: {
		adapter: adapter()
	}
};

export default config;
