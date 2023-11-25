import { sveltekit } from '@sveltejs/kit/vite';

const config = {
	server: {
    fs: {
      allow: [
        // your custom rules
        process.cwd() + '/static/',
    
      ],
    },
  },

	plugins: [
		sveltekit(), 
	]
};

export default config;
