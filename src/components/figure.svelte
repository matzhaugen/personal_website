<script lang="ts">
	interface Props {
		/** Path under /static without extension, e.g. '/covid-mortality/statewide_excess_us' */
		src: string;
		alt?: string;
		width?: string;
		/** Figure number shown in bold before the caption */
		n?: string | number;
		/** Set false to hide the "PDF" download link */
		pdf?: boolean;
		children?: any;
	}

	let { src, alt = '', width = '650', n, pdf = true, children }: Props = $props();

	// Blog media is served from the DigitalOcean Space in production (set via
	// VITE_ASSET_BASE in netlify.toml) and from /static when it's unset, so local
	// dev works with no credentials or network. Keys mirror the static/ paths.
	const ASSET_BASE = import.meta.env.VITE_ASSET_BASE ?? '';

	// Accept a bare base path or an explicit extension; both resolve to the same pair.
	let base = $derived(ASSET_BASE + src.replace(/\.(svg|pdf|png)$/i, ''));
</script>

<figure>
	<img src="{base}.svg" {width} {alt} />
	<figcaption>
		{#if n}<b>Figure {n}:</b>{/if}
		{#if children}{@render children()}{/if}
		{#if pdf}
			<a class="pdf-link" href="{base}.pdf" target="_blank" rel="noopener">PDF</a>
		{/if}
	</figcaption>
</figure>

<style>
	figure {
		margin: 2rem 0;
		text-align: center;
	}

	img {
		max-width: 100%;
		height: auto;
	}

	figcaption {
		font-size: 0.9rem;
		line-height: 1.45;
		text-align: left;
	}

	.pdf-link {
		margin-left: 0.4em;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #777;
		text-decoration: none;
		border-bottom: 1px solid #ccc;
		white-space: nowrap;
	}

	.pdf-link:hover {
		color: #111;
		border-bottom-color: #111;
	}
</style>
