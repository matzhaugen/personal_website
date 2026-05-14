<script lang="ts">
	import { settings } from '$lib/aiDoctor/settingsStore';
	import {
		PROVIDER_LABELS,
		WEBLLM_MODELS,
		type ByokProviderId,
		type ProviderId
	} from '$lib/aiDoctor/types';

	interface Props {
		open: boolean;
		onClose: () => void;
	}
	let { open, onClose }: Props = $props();

	const PROVIDERS: ProviderId[] = ['webllm', 'anthropic', 'openai', 'xai', 'gemini'];
	const BYOK: ByokProviderId[] = ['anthropic', 'openai', 'xai', 'gemini'];

	function setProvider(p: ProviderId) {
		settings.update((s) => ({ ...s, provider: p }));
	}
	function setModel(p: ProviderId, model: string) {
		settings.update((s) => ({ ...s, models: { ...s.models, [p]: model } }));
	}
	function setKey(p: ByokProviderId, key: string) {
		settings.update((s) => ({ ...s, keys: { ...s.keys, [p]: key } }));
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
			<h4>Provider</h4>
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
		</section>

		<section>
			<h4>Model</h4>
			{#if $settings.provider === 'webllm'}
				<select
					value={$settings.models.webllm}
					onchange={(e) => setModel('webllm', e.currentTarget.value)}
				>
					{#each WEBLLM_MODELS as m}
						<option value={m.id}>{m.label} (~{m.sizeGB} GB)</option>
					{/each}
				</select>
				<p class="hint">
					Weights download once on first chat, then cache in your browser. Requires
					WebGPU (Chrome / Edge / Safari 18+). Nothing leaves your device.
				</p>
			{:else}
				<input
					type="text"
					value={$settings.models[$settings.provider]}
					oninput={(e) => setModel($settings.provider, e.currentTarget.value)}
					placeholder="model id"
				/>
				<p class="hint">Override the model id if you want a different one from the same provider.</p>
			{/if}
		</section>

		<section>
			<h4>API keys</h4>
			<p class="hint">
				Keys are stored only in this browser's localStorage. They are sent directly to
				the provider's API and never to my servers. Anyone with access to this browser
				can read them — use a dedicated key with rate limits.
			</p>
			{#each BYOK as p}
				<label class="key-row">
					<span>{PROVIDER_LABELS[p]}</span>
					<input
						type="password"
						autocomplete="off"
						value={$settings.keys[p]}
						oninput={(e) => setKey(p, e.currentTarget.value)}
						placeholder={p === 'gemini' ? 'AIza…' : 'sk-…'}
					/>
				</label>
			{/each}
		</section>
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
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.25rem 0;
	}
	.providers {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	select, input[type="text"] {
		width: 100%;
		padding: 0.4rem 0.5rem;
		font-size: 0.9rem;
	}
	.key-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0.6rem 0;
	}
	.key-row span { font-weight: 500; }
	.key-row input {
		width: 100%;
		padding: 0.4rem 0.5rem;
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
	}
	.hint {
		font-size: 0.8rem;
		color: #666;
		margin: 0.4rem 0 0;
		line-height: 1.4;
	}
</style>
