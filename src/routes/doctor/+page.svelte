<script lang="ts">
	import AiDoctorChat from '../../components/AiDoctorChat.svelte';
	import AiDoctorDisclaimer from '../../components/AiDoctorDisclaimer.svelte';
	import { disclaimerAccepted } from '$lib/aiDoctor/disclaimerStore';
</script>

<svelte:head>
	<title>The AI doctor</title>
	<meta
		name="description"
		content="A private RAG chat over a personal library of papers and posts. Runs in your browser via WebLLM, or bring your own API key."
	/>
</svelte:head>

{#if !$disclaimerAccepted}
	<AiDoctorDisclaimer />
{:else}
	<AiDoctorChat />
{/if}
