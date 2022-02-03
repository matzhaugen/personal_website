import adapter from '@sveltejs/adapter-netlify';
import { mdsvex } from 'mdsvex'
import remarkFootnotes from 'remark-footnotes'
import numberedFootnoteLabels from "remark-numbered-footnote-labels"

export default {
	extensions: ['.svelte', '.svx', '.md'],
	preprocess: mdsvex({ 
		remarkPlugins: [[remarkFootnotes, {inlineNotes: true}]],
		// remarkPlugins: [[numberedFootnoteLabels]],
		extensions: ['.svx', '.md'] }),

		
	kit: {
		adapter: adapter(),
		target: '#svelte',
		vite: {
			mode: "production"
		}
	}

};
