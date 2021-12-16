import adapter from '@sveltejs/adapter-netlify';

export default {
	kit: {
		adapter: adapter(),
		prerender: {
	      crawl: true,
	      enabled: true,
	      onError: 'continue',
	      entries: ['*'],
	    },
		target: '#svelte',
		ssr: false
	}

};
