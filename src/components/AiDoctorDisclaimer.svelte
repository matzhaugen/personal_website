<script lang="ts">
	import { disclaimerAccepted } from '$lib/aiDoctor/disclaimerStore';

	let agreed = $state(false);

	function accept() {
		if (!agreed) return;
		disclaimerAccepted.set(true);
	}
</script>

<div class="overlay">
	<div class="card">
		<h2>Before you start</h2>
		<p>
			This tool searches a corpus of public blog posts and uses an LLM to summarize what
			it finds. <strong>Outputs are model-generated, may be wrong, and are not medical
			advice.</strong> Consult a qualified healthcare professional for medical decisions.
		</p>
		<p>
			Everything runs in your browser. No conversations, retrieved passages, or API keys
			you enter are sent to my servers. The default model is downloaded locally; if you
			paste an API key, requests go directly from your browser to that provider.
		</p>
		<label>
			<input type="checkbox" bind:checked={agreed} />
			I understand.
		</label>
		<button onclick={accept} disabled={!agreed}>Continue</button>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	.card {
		background: white;
		max-width: 540px;
		padding: 1.6rem 1.8rem;
		border-radius: 6px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
		font-size: 0.95rem;
		line-height: 1.45;
	}
	h2 { margin-top: 0; }
	label {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin: 1rem 0;
	}
	button {
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
