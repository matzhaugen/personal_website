import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
	server: {
    fs: {
      allow: [
        // your custom rules
        path.join(__dirname, 'static'),
        path.join(__dirname, 'resume'),
    
      ],
    },
  },

	build: {
		sourcemap: false
	},

	define: {
		__DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
	},

	optimizeDeps: {
		include: ['svelte', '@sveltejs/kit'],
		exclude: ['svelte/internal']
	},

	esbuild: {
		sourcemap: false
	},

	plugins: [
		sveltekit(), 
	]
};

export default config;
