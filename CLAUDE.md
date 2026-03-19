# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build (outputs to /build)
npm run preview      # Preview production build locally
npm run check        # Svelte type checking
npm test             # Run Playwright e2e tests (builds first)
```

## Architecture

Personal portfolio/blog built with **SvelteKit 2** + **Svelte 5** (rune-based reactivity), deployed on Netlify via `@sveltejs/adapter-netlify`.

**Content:** Blog posts are `.md` files processed by `mdsvex` (markdown in Svelte). Posts support frontmatter with `hidden: true` to gate them behind authentication.

**Authentication:** Password-protected hidden posts use a server-side API endpoint (`/api/auth/+server.ts`) that validates against a `BLOG_PASSWORD` environment variable. Auth state lives in `src/lib/authStore.ts` (Svelte store with localStorage persistence). The `.env` file (git-ignored) holds the actual password — see `.env.example`.

**Blog language toggle:** The blog supports English/Norwegian posts; language preference is stored in localStorage and respected in `/routes/blog/+page.svelte`.

**Data viz:** Some pages use D3.js (`d3-array`, `d3-cloud`) for word clouds and charts. CSV data files live in `src/lib/`.

## Key Conventions

- Formatting: tabs, single quotes, 100-char line width (see `.prettierrc`)
- TypeScript: `allowJs: true` — JS files are type-checked via `jsconfig.json`
- Static assets go in `/static`; resume files go in `/resume`
- Production builds have sourcemaps disabled (see `vite.config.js`)
