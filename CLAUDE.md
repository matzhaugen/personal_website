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

**Content:** Blog posts are `.md` files processed by `mdsvex` (markdown in Svelte). Posts support frontmatter: `title`, `description`, `date`, `authors`, `language` (English | Norwegian), and `hidden: true` to gate them behind authentication. All markdown files automatically inherit the blog layout (`src/routes/blog/+layout.svelte`).

**Authentication:** Password-protected content uses a server-side API endpoint (`/api/auth/+server.ts`) that validates against a `BLOG_PASSWORD` environment variable. Auth state lives in `src/lib/authStore.ts` (Svelte writable store with localStorage persistence under key `blog_authenticated`). The `.env` file (git-ignored) holds the actual password — see `.env.example`. The `/law` route also enforces auth via its own layout.

**Blog language toggle:** The blog supports English/Norwegian posts; language preference is stored in localStorage and respected in `src/routes/blog/+page.svelte`. Post discovery uses `import.meta.glob()` to dynamically import all `.md` files and extract frontmatter.

**Data viz:**
- `/economics` — Macro-economics charts using `@sveltejs/pancake`. Data loaded server-side from `static/data/commodity_prices.csv` and `static/data/macro.json` (sourced from Stooq/FRED).
- `/satellites` — LEO satellite launch chart (Starlink/OneWeb 2019-2022) using Pancake. Data in `static/satellite_data.js`.
- `/covid-papers` — Research paper database with interactive word cloud filtering using `d3-cloud` and `d3-array`. Data in `src/lib/react19data_merge.json`. Supports CSV export.

## Routes

| Route | Notes |
|-------|-------|
| `/` | Home/About |
| `/blog` | Post listing with EN/NO language toggle |
| `/blog/[slug]` | Dynamic post page |
| `/research` | Research projects and papers |
| `/books` | Curated book lists |
| `/software` | Software projects |
| `/satellites` | LEO satellite launch data viz |
| `/economics` | Macro-economics charts (server-rendered data) |
| `/covid-papers` | COVID research DB with word cloud (server-rendered data) |
| `/resume` | Resume display |
| `/pregnancy` | Pregnancy resources (`.md` page) |
| `/links` | Curated links (`.md` page) |
| `/law/taxation` | Auth-protected tax law notes |

## Key Conventions

- Formatting: tabs, single quotes, 100-char line width (see `.prettierrc`)
- TypeScript: `allowJs: true`, `checkJs: true`, `strict: true` — JS files are type-checked via `jsconfig.json`
- Static assets go in `/static`; resume source files go in `/resume`
- Production builds have sourcemaps disabled (see `vite.config.js`)
- Svelte 5 runes: use `$state()`, `$effect()`, `$derived()` — not legacy `let`/`onMount` patterns
- Components live in `src/components/`; shared stores/data in `src/lib/`
- Type definitions in `src/types/` (`modules.d.ts`, `array-extensions.d.ts`)
- Google Analytics is integrated via `@beyonk/svelte-google-analytics`
