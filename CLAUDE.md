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

## AI Doctor (`/doctor`) — browser RAG chat (added 2026-07)

A public RAG chat over the corpus built by the separate **`rag-pipeline`** repo (papers + blog posts). **Retrieval always runs client-side; generation has two selectable backends.** Route is public (auth gate removed) and linked from the top nav + the `/software` page.

- **Library code:** `src/lib/aiDoctor/` — `embedder.ts` (transformers.js runs `nomic-embed-text-v1.5` in ONNX for the query embedding, must match rag-pipeline's `search_query:` prefix + L2 norm), `dense.ts` + `bm25.ts` + `retrieval.ts` (hybrid RRF over the exported assets), `prompt.ts`, `postprocess.ts` (citation renumbering), `settingsStore.ts`, `manifest.ts`, `types.ts`, and `llm/` (`index.ts` dispatch, `webllm.ts`, `groq.ts`).
- **Components:** `src/components/AiDoctor{Chat,Settings,Sources,Disclaimer}.svelte`.
- **Static assets:** `static/ai-doctor/{embeddings.bin,chunks.json,bm25.json,manifest.json}` — produced by `rag-pipeline/scripts/export_for_web.py`. **Re-run that export whenever the rag-pipeline index is rebuilt** (e.g. after ingesting new papers) or the chat serves a stale corpus. These files are large (tens–hundreds of MB) and are the browser's full first-load download.
- **Two generation backends** (chosen in the ⚙ Settings drawer; default is Groq):
  - **`groq`** (default) — hosted Llama via `src/routes/api/doctor-chat/+server.ts`, a SvelteKit server endpoint (deploys as a Netlify function) that holds the key **server-side** and streams the answer back as plain text. Works on **any** browser. Prompts leave the device (disclaimer says so).
  - **`webllm`** — runs the model fully in-browser via WebGPU (`@mlc-ai/web-llm`). Private, but WebGPU-gated (see below).
- **Prompt policy — grounded-with-ignorance** (`prompt.ts`): answers **only** from retrieved `[Source N]` passages; when they don't cover the question it says so ("not in the library") instead of using general knowledge; `[GK]` allowed only to define a standard term. Mirrors `rag-pipeline/src/rag_pipeline/generation.py` — keep the two in sync.
- **Cost safety (Groq), two layers:** (1) **hard guarantee** — `GROQ_API_KEY` is created on a Groq account with **NO billing attached**, so exceeding the free tier returns HTTP 429, never a charge; (2) **graceful cap** — a Netlify Blobs daily counter (`doctor-usage` store, `DAILY_CAP` in `+server.ts`) sheds load to a friendly "switch to WebLLM" message before the free-tier ceiling. Blobs failure is fail-open (the no-billing key is the real backstop).
- **Env var:** `GROQ_API_KEY` — set in Netlify site env (and local `.env` for dev). Until it's set, the Groq path returns a "not configured — switch to WebLLM" message rather than erroring.
- **WebGPU support reality (why WebLLM is fragile):** needs WebGPU **and** the `shader-f16` feature (all listed q4f16 models require it). Chrome/Edge = best; **Safari 26+** on by default (Safari 18 = behind Develop→Feature Flags→WebGPU); **Firefox** 142 (Windows) / 147 (Apple Silicon) but **lacks `shader-f16` on macOS → all models fail**; iOS/Linux/Intel-Mac = gaps. On macOS (Metal) the storage-buffer limit is 8, so the WebLLM model default is a small one (`Qwen2.5-1.5B`); the 3B lib needs 10 buffers and fails. Groq sidesteps all of this.

## Routes

| Route | Notes |
|-------|-------|
| `/` | Home/About |
| `/blog` | Post listing with EN/NO language toggle |
| `/blog/[slug]` | Dynamic post page |
| `/research` | Research projects and papers |
| `/books` | Curated book lists |
| `/software` | Software projects (links to `/doctor`) |
| `/doctor` | Public AI Doctor — browser RAG chat (Groq or WebLLM). See "AI Doctor" above |
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
