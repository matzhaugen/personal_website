import adapter from '@sveltejs/adapter-netlify';
import path from 'path'
export default {
	kit: {
		adapter: adapter(),
		target: '#svelte',
		vite: {
			mode: "production",
            resolve: {
                alias: {
                    // these are the aliases and paths to them
                    '@components': path.resolve('src/lib/components'),
                    '@lib': path.resolve('src/lib'),
                    '@posts': path.resolve('src/posts')
                },
                extensions: ['.md', '.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
            }
		}
	}

};
