<script lang="ts">
	interface Props {
		children?: any;
	}
	let { children }: Props = $props();

	// Public route — no auth gate. The AI doctor runs entirely in the
	// visitor's browser (WebLLM + client-side retrieval), so there's nothing
	// server-side to protect.
</script>

<div class="doctor-root">
	{@render children?.()}
</div>

<style>
	/* Load the close-enough open fonts (Lora ≈ Tiempos Text, Inter ≈ Styrene B).
	   The font-family stack tries 'Tiempos Text' / 'Styrene B' first — if either
	   is installed system-wide it gets used; otherwise the browser falls through
	   to Lora / Inter without making any HTTP requests. To opt-in to the
	   proprietary webfonts later, drop the woff2 files at static/fonts/ and add
	   @font-face rules pointing at /fonts/{name}.woff2. */
	@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap');

	/* Scoped to /doctor — the rest of the site keeps its existing typography. */
	.doctor-root {
		font-family: 'Styrene B', 'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
	}
	/* Assistant message body uses the serif. Selector wins because of
	   specificity + chained classes; descendant selectors via :global so
	   the chat component's children get the rule. */
	.doctor-root :global(.assistant-msg),
	.doctor-root :global(.assistant-msg p),
	.doctor-root :global(.assistant-msg li),
	.doctor-root :global(.assistant-msg blockquote) {
		font-family: 'Tiempos Text', 'Lora', Georgia, 'Times New Roman', serif;
		font-size: 1.0625rem;
		line-height: 1.65;
		letter-spacing: -0.005em;
	}
</style>
