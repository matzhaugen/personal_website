<script lang="ts">
	import { isAuthenticated } from '$lib/authStore';
	import { goto } from '$app/navigation';

	interface Props {
		children?: any;
	}
	let { children }: Props = $props();

	// Auth gate — matches the /blog and /law guard pattern. The password
	// modal lives in the root +layout.svelte; an unauthenticated visit
	// bounces back to / where the user can open the modal via the sun icon.
	$effect(() => {
		if (!$isAuthenticated) goto('/');
	});
</script>

{#if $isAuthenticated}
	<div class="doctor-root">
		{@render children?.()}
	</div>
{/if}

<style>
	/* Load the close-enough open fonts (Lora ≈ Tiempos Text, Inter ≈ Styrene B).
	   The proprietary Anthropic webfonts can be dropped at
	   static/fonts/{Tiempos-Text-Regular,Tiempos-Text-Italic,StyreneB-Regular}.woff2
	   and they'll be picked up via the local() + URL fallback below. */
	@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap');

	@font-face {
		font-family: 'Tiempos Text';
		src:
			local('Tiempos Text'),
			url('/fonts/Tiempos-Text-Regular.woff2') format('woff2');
		font-weight: 400;
		font-style: normal;
		font-display: swap;
	}
	@font-face {
		font-family: 'Tiempos Text';
		src:
			local('Tiempos Text Italic'),
			url('/fonts/Tiempos-Text-Italic.woff2') format('woff2');
		font-weight: 400;
		font-style: italic;
		font-display: swap;
	}
	@font-face {
		font-family: 'Styrene B';
		src:
			local('Styrene B'),
			url('/fonts/StyreneB-Regular.woff2') format('woff2');
		font-weight: 400;
		font-style: normal;
		font-display: swap;
	}

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
