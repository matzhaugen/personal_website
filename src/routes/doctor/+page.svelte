<script lang="ts">
	import AiDoctorChat from '../../components/AiDoctorChat.svelte';
	import AiDoctorDisclaimer from '../../components/AiDoctorDisclaimer.svelte';
	import { disclaimerAccepted } from '$lib/aiDoctor/disclaimerStore';
</script>

<svelte:head>
	<title>The AI doctor</title>
	<meta
		name="description"
		content="A RAG chat over a personal library of papers and posts. Answers from a hosted model (Groq) by default, or fully in-browser via WebLLM (WebGPU) for privacy."
	/>
</svelte:head>

{#if !$disclaimerAccepted}
	<AiDoctorDisclaimer />
{:else}
	<AiDoctorChat />
{/if}
