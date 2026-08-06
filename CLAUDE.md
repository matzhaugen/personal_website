# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build (outputs to /build)
npm run preview      # Preview production build locally
npm run check        # Svelte type checking
npm test             # Run Playwright e2e tests (builds first)
npm run figures      # Convert figure PDFs in static/*/ to SVG (needs `brew install poppler`)
npm run videos       # Faststart MP4s in static/*/; add `-- --encode` to CRF-compress (needs ffmpeg)
npm run assets       # Upload blog media from static/*/ to the DigitalOcean Space (needs awscli + DO_* keys)
npm run publish      # figures → videos → assets, in that order. The normal way to ship new figures.
                     #   npm run publish -- covid-mortality   # scope to one directory
                     #   npm run publish -- --check           # verify only; exits 1 if stale (pre-push hook)
npm run index        # Upload the AI Doctor retrieval index from static/ai-doctor.
                     #   A DIFFERENT script from `assets` — see the AI Doctor section.
```

## Architecture

Personal portfolio/blog built with **SvelteKit 2** + **Svelte 5** (rune-based reactivity), deployed on Netlify via `@sveltejs/adapter-netlify`.

**Content:** Blog posts are `.md` files processed by `mdsvex` (markdown in Svelte). Posts support frontmatter: `title`, `description`, `date`, `authors`, `language` (English | Norwegian), and `hidden: true` to gate them behind authentication. All markdown files automatically inherit the blog layout (`src/routes/blog/+layout.svelte`).

**Figures:** Browsers can't render a PDF in `<img>`, so vector figures are authored as PDF (matplotlib/R output, kept as source of truth in `static/<post-slug>/`) and converted to SVG siblings with `npm run figures` (poppler's `pdftocairo`). The generated `.svg` files must be committed — the Netlify build image has no poppler. Posts embed them with `src/components/figure.svelte`, which takes an extension-less path and wires up both the SVG `<img>` and a "PDF" download link:

```svelte
<script>
  import Figure from '../../../components/figure.svelte';
</script>

<Figure src="/covid-mortality/statewide_excess_us" n="1" alt="...">Caption text</Figure>
```

PDFs at the top level of `static/` (resume, article reprints) are intentionally skipped by the converter.

**Video figures:** `src/components/video-figure.svelte`, same conventions (`<VideoFigure src="/covid-mortality/statewide_excess_map" n="4" loop fps={209 / 20}>`). It sets `preload="metadata"`, so nothing but the header is fetched until the reader presses play. Passing `fps` enables ←/→ single-frame stepping (Shift+← / → for ±1s); browsers don't expose the frame rate, so read it off the file with `ffprobe -show_entries stream=r_frame_rate`. The handler must capture on the wrapping `<figure>`, not bubble on the `<video>` — Chrome's built-in controls seek inside the video's shadow DOM before a bubble-phase listener runs, which would compound with our own step. After exporting a new MP4, run `npm run videos -- --encode`. It does two idempotent things: re-encodes with libx264 CRF 20 / `veryslow` (matplotlib writes a fixed high bitrate that wastes bits on a near-static image — this cut `statewide_excess_map.mp4` from 3.55 MB to 617 KB at mean VMAF 97.3), and moves the `moov` index atom ahead of the media data so playback starts without a round-trip to the end of the file. Encoded files are tagged in their container metadata and skipped on later runs, so repeated calls can't stack generational loss; `--force` overrides, `--crf N` picks a different quality. `npm run videos` with no flags only does the faststart step and needs no ffmpeg (`scripts/mp4-faststart.js` is the standalone remuxer).

**Adding a figure:** export the PDF/MP4 into `static/<post-slug>/`, run `npm run publish -- <post-slug>`, then reference it with `<Figure>` / `<VideoFigure>` (extension-less `src`). The order in `publish` matters — `figures` and `videos` rewrite files in place, so uploading first would ship unprocessed assets. Uploads carry `max-age=86400`, so a figure re-exported under the same name can serve stale from the CDN for up to a day; purge in the DO panel or vary the filename.

**Media manifest & push gate:** `media-manifest.json` (repo root, committed) records a SHA-256 per file: which PDF each SVG was generated from, and what was last uploaded to the Space. `npm run publish -- --check` compares those against the files on disk and exits non-zero if anything is stale, which `.githooks/pre-push` runs to block a push. Hashes rather than mtimes, deliberately — git doesn't preserve mtimes, so after a fresh clone a timestamp comparison is meaningless and would wave a stale SVG straight through. Enable the hook on a new clone with `git config core.hooksPath .githooks`; bypass once with `git push --no-verify`. `--remote` additionally HEADs every object on the CDN.

**Media hosting:** Blog figures and videos are mirrored to a DigitalOcean Space (bucket `stackmap`, region `sfo3`, public-read, CDN enabled) by `npm run assets` — credentials come from `DO_ACCESS_KEY` / `DO_SECRET_KEY` in the environment, never from a file in the repo. Object keys mirror the local paths (`static/covid-mortality/x.svg` → `<cdn>/covid-mortality/x.svg`), so the only difference between local and production is an origin prefix. `figure.svelte` and `video-figure.svelte` read `import.meta.env.VITE_ASSET_BASE`, which `netlify.toml` sets for production builds and which is unset locally, falling back to `/static`. Note that older posts embed raw `<img src="/…">` tags that bypass the components and are always served by Netlify.

**Authentication:** Password-protected content uses a server-side API endpoint (`/api/auth/+server.ts`) that validates against a `BLOG_PASSWORD` environment variable. Auth state lives in `src/lib/authStore.ts` (Svelte writable store with localStorage persistence under key `blog_authenticated`). The `.env` file (git-ignored) holds the actual password — see `.env.example`. The `/law` route also enforces auth via its own layout.

**Blog language toggle:** The blog supports English/Norwegian posts; language preference is stored in localStorage and respected in `src/routes/blog/+page.svelte`. Post discovery uses `import.meta.glob()` to dynamically import all `.md` files and extract frontmatter.

**Data viz:**
- `/economics` — Macro-economics charts using `@sveltejs/pancake`. Data loaded server-side from `static/data/commodity_prices.csv` and `static/data/macro.json` (sourced from Stooq/FRED).
- `/satellites` — LEO satellite launch chart (Starlink/OneWeb 2019-2022) using Pancake. Data in `static/satellite_data.js`.
- `/covid-papers` — Research paper database with interactive word cloud filtering using `d3-cloud` and `d3-array`. Data in `src/lib/react19data_merge.json`. Supports CSV export.

## AI Doctor (`/doctor`) — browser RAG chat (added 2026-07)

A public RAG chat over the corpus built by the separate **`rag-pipeline`** repo (papers + blog posts). **Retrieval runs client-side; generation is server-side only (Groq).** Route is public (auth gate removed) and linked from the top nav + the `/software` page.

- **Library code:** `src/lib/aiDoctor/` — `embedder.ts` (transformers.js runs `nomic-embed-text-v1.5` in ONNX for the query embedding, must match rag-pipeline's `search_query:` prefix + L2 norm), `dense.ts` + `bm25.ts` + `retrieval.ts` (hybrid RRF over the exported assets), `prompt.ts`, `postprocess.ts` (citation renumbering), `manifest.ts`, `types.ts`, and `llm/` (`index.ts`, `groq.ts`).
- **Components:** `src/components/AiDoctor{Chat,Sources,Disclaimer}.svelte`. There is no settings UI — the model is fixed server-side, so there is nothing for a visitor to choose.
- **Static assets** (schema_version 2) — produced by `rag-pipeline/scripts/export_for_web.py`, gitignored, and served from the DigitalOcean Space `stackmap` via `VITE_ASSET_BASE`. Upload with **`npm run index`** (`scripts/upload-index.js`, needs `DO_ACCESS_KEY`/`DO_SECRET_KEY`). **Re-run the export + upload whenever the rag-pipeline index is rebuilt**, or the chat serves a stale corpus.

  **`npm run index` is not `npm run assets`.** They are different scripts against the same bucket, and the names are easy to confuse. `assets` (`scripts/upload-assets.js`) syncs blog figures/videos from the `MEDIA_DIRS` list and is step 3 of `npm run publish`; it knows nothing about gzip encoding or manifest ordering, so pointing it at `static/ai-doctor` would upload `chunks-text.bin` under the wrong encoding and publish `manifest.json` in arbitrary order — both silent-corruption paths (see the invariants below). `index` (`scripts/upload-index.js`) is the only script that may touch `static/ai-doctor`.

  | File | Role | Raw | On the wire |
  |---|---|---|---|
  | `embeddings.i8` | float32 scales, then int8 vectors | 43.4 MB | 36.7 MB |
  | `bm25.bin` | term-major inverted index, delta-coded doc ids, uint8 tf | 46.4 MB | 11.1 MB |
  | `bm25-vocab.json` | term → column | 4.5 MB | 1.8 MB |
  | `chunks-meta.json` | doc metadata (deduped) + per-chunk byte offsets | 9.6 MB | 1.1 MB |
  | `manifest.json` | schema/shape; **version-checked before any binary is parsed** | — | — |
  | `chunks-text.bin` | chunk bodies | 93.4 MB | **0** — HTTP Range per query |

  Full corpus (**56,181 chunks / 3,879 docs**, rebuilt 2026-08-06) is **~51 MB on first load**; a naive float32 + JSON export is ~240 MB.

  **Three upload invariants, all silent-corruption hazards** (enforced in `scripts/upload-index.js`):
  1. **`chunks-text.bin` must never be gzipped.** A gzip-encoded object serves Range requests over the *compressed* representation, so every byte offset would point somewhere wrong and `chunks.ts` would decode garbage rather than error. Everything else is pre-gzipped with `Content-Encoding: gzip` — DO's CDN auto-compresses text types on the fly but leaves `application/octet-stream` alone, so without this `bm25.bin` ships at 41.7 MB instead of 10.0 MB.
  2. **`manifest.json` uploads last.** The browser version-checks it before parsing any binary, so publishing it first hands anyone loading mid-upload a new manifest describing old-layout data — which parses cleanly and scores nonsense.
  3. **Every asset but the manifest is fetched with `?v=<build_timestamp>`** (`src/lib/aiDoctor/assets.ts`), and the manifest itself with a minute-bucketed parameter plus `Cache-Control: max-age=60`. **Re-uploading an object does NOT evict a cached edge copy inside its TTL** — on 2026-08-06 all five binaries refreshed while the CDN kept serving a nine-month-old `schema_version 1` manifest for another 16 hours, taking `/doctor` down. Versioning by build timestamp means a rebuilt index lands on URLs that cannot hit a stale entry. The dangerous pairing is `chunks-meta.json` + `chunks-text.bin`: offsets address bytes, so mixing generations decodes real text at wrong boundaries — plausible garbage attributed to real sources, with no error. (`dense.ts` does validate `byteLength === n*4 + n*dim` and throws; the chunk pair has no such check, which is why both carry the same `?v=`.)

- **Paper citation metadata depends on ingest order.** `parsing.py` applies `data/papers/papers_metadata.json` (DOI/authors/year/journal, and a real title in place of the PDF's publisher banner) only at ingest time, and the junk title is embedded into the vector. If `export_for_web.py` warns that papers lack DOIs, re-run `uv run rag ingest` before exporting — otherwise citations are unusable *and* retrieval is degraded.
- **Two hosted backends, rotated server-side.** `src/routes/api/doctor-chat/+server.ts` (a SvelteKit endpoint, deploys as a Netlify function) holds both keys **server-side**, tries the providers in order, and streams the answer back as plain text. Works on **any** browser. Prompts leave the device (the disclaimer says so). The browser has a single provider-agnostic adapter (`llm/hosted.ts`); which vendor answered comes back in the `x-doctor-provider` response header and is logged to the console in dev only.

  Measured from each vendor's `x-ratelimit-*` headers, against a ~3.2k-token prompt:

  | | model | per minute | per day | effective |
  |---|---|---|---|---|
  | **cerebras** (preferred) | `gpt-oss-120b` | 5 req / 30k tok | 1M tokens | ~5 questions/min |
  | **groq** (failover) | `llama-3.1-8b-instant` | 30 req / 6k tok | 14,400 req | ~1.5 questions/min |

  They run out in **opposite** ways — Groq is starved by tokens-per-minute long before its 30 RPM matters; Cerebras by requests-per-minute while it still has token budget to spare — which is what makes them complement rather than duplicate each other. Verified live: 8 concurrent requests → 5 served by Cerebras, 3 by Groq, zero 429s.
  - **Failover is a pre-stream decision only.** Once the first byte is on the wire we are committed; a mid-stream failure cannot be retried without the client discarding a partial answer.
  - **401/402/403 parks a provider for 10 min** (in-memory `disabledUntil`, module scope = warm-instance lifetime, decays for free). An account-level problem shouldn't add a wasted round-trip to every visitor's latency.
  - **Cerebras `dailyCap` is 180, not its 2,400 req/day limit** — the 1M tokens/day ceiling binds first (~200 questions at ~5k tokens each). The counter is per-request so it can only approximate a token budget.
  - **gpt-oss is a reasoning model.** `max_completion_tokens` (2000) covers hidden reasoning too, and only `delta.content` is forwarded — `delta.reasoning` is the private scratchpad and must never be shown as the answer. Too small a budget yields an **empty** answer, not a truncated one. `reasoning_effort: 'low'`.
  - **gpt-oss writes 【Source 1】 with full-width CJK brackets**, ignoring the prompt's ASCII form. `postprocess.ts` normalizes these *before* matching, and that ordering is load-bearing: `CITATION_RE` is ASCII-only, so unnormalized text looks like zero citations and takes the GK-only branch that **deletes the References section**.
  - Both providers speak the same OpenAI-compatible wire format, so one code path drives both. Use `max_completion_tokens`, not the deprecated `max_tokens` — verified enforced on both.
  - **The in-browser WebLLM path was removed on 2026-08-05** (`@mlc-ai/web-llm` uninstalled, `llm/webllm.ts` + `settingsStore.ts` + `AiDoctorSettings.svelte` deleted). It needed WebGPU **and** `shader-f16`: Chrome/Edge fine, Safari 26+ fine, but Firefox lacks `shader-f16` on macOS (every model failed), Safari 18 needed a feature flag, and iOS/Linux/Intel-Mac were patchy — so the "private by default" backend was simply broken for a large share of visitors. If it's ever revived, note the macOS Metal storage-buffer limit of 8: `Qwen2.5-1.5B` fits, the Llama-3.2-3B lib needs 10 and fails.
  - **Throughput, not cost, is the binding constraint** (~$0.000215/question on Groq at ~3.2k input + ≤700 output tokens). Rotation is the first-line fix; if it ever bites again, dropping `FINAL_K` in `retrieval.ts` from 5 to 3 cuts input tokens ~40% and helps **both** providers at once — Groq's TPM directly, Cerebras's daily token ceiling proportionally.
- **Diversity caps decide what the answer looks like** (`retrieval.ts`). Chunks adjacent within one section of one article score almost identically, so an uncapped top-5 comes back as five slices of one passage — which reads to a visitor as five independent corroborations when it is one author making one argument once. Two caps, applied over the RRF ranking:
  - `MAX_PER_WORK = 2` and `MAX_PER_SECTION = 1`, loosened through `CAP_LADDER` only as far as needed to reach `FINAL_K`. The old code capped at 3/document and then **topped up ignoring caps entirely**, which handed the freed slots straight back to the document that had just been capped.
  - **The cap keys on the normalized doc *title*, not `doc_id`.** Substack mints a new slug when a post is republished, so the corpus carries **25 near-duplicate documents under 23 shared titles** — chlorine dioxide, DMSO and the dermatology posts among them, all heavily queried. Keyed on `doc_id` the copies get separate allowances, so "max 2 per document" silently permits 4. Verified on the live index: *"Is there any benefit to taking chlorine dioxide?"* returned **1 distinct work** before and **4** after; the vaccine-placebo question went 4 → 5 works and 4 → 5 distinct sections.
  - Deduplicating the corpus is still worth doing at the next ingest (`data/posts/`, same title + publication, keep the newest) — it would also fix BM25 IDF, which currently counts republished text twice. The title-keyed cap is what holds without a re-ingest.
- **Follow-up context is conditional, and that is load-bearing** (`retrieval.ts`). The chat hands `retrieve()` the previous answer as `priorAnswer`; retrieval prepends it **only when the bare question scores below `SELF_CONTAINED_COSINE` (0.72)**. Prepending unconditionally — the original behaviour — made any self-contained question asked mid-conversation retrieve the *previous* topic: "Is the sun harmful?" after an answer about AI scored 0.779 on the sun posts bare, but 0.810 on AI posts once enriched. Because the hijacked query scores **higher**, `MIN_TOP_COSINE` cannot catch it. `MIN_BARE_COSINE` (0.60) additionally refuses anything whose bare question is far off-corpus, so history can't rescue "best pizza in Naples" (0.547 bare → 0.770 enriched). Calibrated 14/14 on a hand-built set; both constants sit mid-plateau. **Re-check these if the embedding model or corpus changes.**
- **`SELF_CONTAINED_COSINE` alone is not enough, because it also measures verbosity** (`retrieval.ts`). The threshold conflates *how anaphoric* a question is with *how wordy* it is: under mean pooling one content word gets diluted by filler, so a self-contained question can land in the anaphoric band on phrasing alone. Measured in-browser, same subject, opposite verdicts — `"is the sun harmful?"` **0.779 → bare**, `"What do you know about using sunscreen? Is it safe?"` **0.687 → enriched**. The second, asked after an answer about vaccine placebos, retrieved five placebo passages and answered "the library doesn't cover sunscreen" over a corpus with three articles on it. `MIN_TOP_COSINE` cannot catch this — the hijacked query scored **0.847**, higher than the honest one. The fix is `RESERVED_BARE = 2`: when we enrich *and* the bare question clears `MIN_TOP_COSINE`, its own top matches are seeded into the final set before the fused ranking fills the rest, so enrichment can no longer discard what the user asked about. Safe because a genuine anaphoric follow-up scores **below** `MIN_TOP_COSINE` bare (0.635–0.680 vs a 0.65 floor) and so reserves nothing. `reservedBare` is in the diagnostics: **a hijack now looks like `path: 'enriched'` with `reservedBare: 0`.**
- **A rare-term "lexical anchor" gate was tried and rejected — don't re-propose it.** The idea was to skip enrichment when the bare question contains a high-IDF content word. Measured against the real BM25 index it inverts: `banned` **6.01** > `ivermectin` **3.97** > `dmso` **3.41**. IDF measures corpus rarity, and in a corpus largely *about* ivermectin and DMSO the actual topic words are common by construction, while an anaphoric question's verb can be rare. The gate would mark "why was it banned?" self-contained and "does ivermectin work?" anaphoric.
- **These thresholds can only be calibrated in-browser.** The ONNX/transformers.js embedder does not agree with `sentence-transformers` offline: the same sunscreen query scored **0.687 in the browser vs 0.729 offline**, which straddles `SELF_CONTAINED_COSINE`. Use the dev-only log (`doctor-queries.jsonl`, written by `/api/doctor-log`) for tuning — it records `bareTopCosine`, `topCosine`, `path`, `reservedBare` and the matched titles per turn. Offline probes are for confirming a document is *in* the index, not for setting constants.
- **Prompt policy — grounded-with-ignorance** (`prompt.ts`): answers **only** from retrieved `[Source N]` passages; when they don't cover the question it says so ("not in the library") instead of using general knowledge; `[GK]` allowed only to define a standard term. Mirrors `rag-pipeline/src/rag_pipeline/generation.py` — keep the two in sync. **Currently diverged:** the Voice section and the `--- LIBRARY PASSAGES ---` delimiters below are web-only until ported.
- **The prompt must not name its own plumbing.** Answers used to open "The retrieved context suggests…" because the context block was headed `--- RETRIEVED CONTEXT ---` and the closing instruction said "using ONLY the retrieved context above" — the model echoes the vocabulary it is shown. The delimiters are now `--- LIBRARY PASSAGES ---` and a **Voice** section in `SYSTEM_PROMPT` bans retrieval narration outright: write about the subject, let the `[Source N]` tags carry the grounding, and name gaps as "the library doesn't cover X". Keep that in mind before reintroducing any "context"/"passages" wording into either prompt.
- **Cost safety, and it is now asymmetric between the two providers:**
  - **Groq — hard guarantee.** `GROQ_API_KEY` is on an account with **NO billing attached**, so exceeding the free tier returns HTTP 429, never a charge. Nothing in code is load-bearing for that.
  - **Cerebras — NO such guarantee.** The account has **prepaid credits** (added 2026-08-05 to lift an HTTP 402 `payment_required` that blocked every completion). Credits can be *spent*, so here the `dailyCap` of 180 is a real spend control, not just a UX nicety. If the account is ever switched to auto-recharge, this becomes the only thing standing between a traffic spike and a bill — set a hard spend limit in the Cerebras console rather than relying on it.
  - **Graceful cap, both.** A Netlify Blobs daily counter (`doctor-usage` store, key `<provider>-YYYY-MM-DD`) stops calling a provider at its `dailyCap` and falls through to the next. Counted per provider and only for one we are about to call, so a failover doesn't burn quota against the provider it skipped. Blobs failure is fail-open.
  - Exhausting **both** providers means no answers until the caps reset — search still works.
- **Env vars:** `CEREBRAS_API_KEY` and `GROQ_API_KEY` — set in Netlify site env (and local `.env` for dev). Either alone is enough to serve answers; the endpoint skips a provider whose key is absent. With neither set it returns `not_configured` and the chat says the model isn't configured yet rather than erroring.

## Routes

| Route | Notes |
|-------|-------|
| `/` | Home/About |
| `/blog` | Post listing with EN/NO language toggle |
| `/blog/[slug]` | Dynamic post page |
| `/research` | Research projects and papers |
| `/books` | Curated book lists |
| `/software` | Software projects (links to `/doctor`) |
| `/doctor` | Public AI Doctor — client-side retrieval, Groq generation. See "AI Doctor" above |
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
