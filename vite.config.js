import { sveltekit } from '@sveltejs/kit/vite';

const config = {
	server: {
    fs: {
      allow: [
        // your custom rules
        process.cwd() + '/static/',
        process.cwd() + '/resume/',
    
      ],
    },
  },

	plugins: [
		sveltekit(), 
	]
};

export default config;
