<script lang="ts">
	import { settings } from '$lib/aiDoctor/settingsStore';
	import { WEBLLM_MODELS, PROVIDER_LABELS, type ProviderId } from '$lib/aiDoctor/types';

	interface Props {
		open: boolean;
		onClose: () => void;
	}
	let { open, onClose }: Props = $props();

	const PROVIDERS: ProviderId[] = ['groq', 'webllm'];

	function setProvider(p: ProviderId) {
		settings.update((s) => ({ ...s, provider: p }));
	}
	function setWebllmModel(model: string) {
		settings.update((s) => ({ ...s, models: { ...s.models, webllm: model } }));
	}
</script>

{#if open}
	<div class="backdrop" role="presentation" onclick={onClose}></div>
	<aside class="drawer" role="dialog" aria-label="AI Doctor settings">
		<header>
			<h3>Settings</h3>
			<button class="close" onclick={onClose} aria-label="Close">×</button>
		</header>

		<section>
			<h4>Where the model runs</h4>
			<div class="providers">
				{#each PROVIDERS as p}
					<label class="row">
						<input
							type="radio"
							name="provider"
							value={p}
							checked={$settings.provider === p}
							onchange={() => setProvider(p)}
						/>
						<span>{PROVIDER_LABELS[p]}</span>
					</label>
				{/each}
			</div>
			{#if $settings.provider === 'groq'}
				<p class="hint">
					Answers come from a hosted Llama model (Groq). Works on any browser, no
					download. Your question and the retrieved passages are sent to Groq to
					generate the answer — they don't stay on your device.
				</p>
			{/if}
		</section>

		{#if $settings.provider === 'webllm'}
			<section>
				<h4>Model</h4>
				<select
					value={$settings.models.webllm}
					onchange={(e) => setWebllmModel(e.currentTarget.value)}
				>
					{#each WEBLLM_MODELS as m}
						<option value={m.id}>{m.label} (~{m.sizeGB} GB)</option>
					{/each}
				</select>
				<p class="hint">
					The model runs entirely in your browser (WebLLM / WebGPU). Weights download
					once on first chat, then cache locally. Requires WebGPU (Chrome / Edge /
					Safari 26+). Nothing you type ever leaves your device.
				</p>
			</section>
		{/if}
	</aside>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		z-index: 800;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(420px, 95vw);
		background: white;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
		padding: 1.2rem 1.4rem;
		overflow-y: auto;
		z-index: 801;
		font-size: 0.9rem;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h3 { margin: 0; }
	h4 {
		margin: 1.5rem 0 0.5rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #666;
	}
	.close {
		background: none;
		border: none;
		font-size: 1.6rem;
		line-height: 1;
		cursor: pointer;
	}
	select {
		width: 100%;
		padding: 0.4rem 0.5rem;
		font-size: 0.9rem;
	}
	.providers {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		padding: 0.15rem 0;
		cursor: pointer;
	}
	.hint {
		font-size: 0.8rem;
		color: #666;
		margin: 0.4rem 0 0;
		line-height: 1.4;
	}
</style>
