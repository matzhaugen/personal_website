
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
		// Deliberately NOT a `+layout.svelte` under src/routes: SvelteKit would then
		// apply it as a route layout as well, wrapping every markdown page twice
		// (two <article>s, two floating TOCs, an empty outer <h1>). mdsvex is the
		// single source here because it hands frontmatter to the layout as props,
		// which a route layout cannot do, and because it targets .md files rather
		// than a route subtree — so /books, /law, /links and /pregnancy get the
		// same treatment as /blog/* without a layout file in each directory.
		layout: "./src/components/blog-layout.svelte",
	}),
		
	kit: {
		adapter: adapter()
	}
};

export default config;
