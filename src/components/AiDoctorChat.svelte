<script lang="ts">
	import { onMount } from 'svelte';
	import {
		messages,
		appendMessage,
		updateLastAssistant,
		clearChat
	} from '$lib/aiDoctor/chatStore';
	import { settings } from '$lib/aiDoctor/settingsStore';
	import { retrieve } from '$lib/aiDoctor/retrieval';
	import { buildUserPrompt, SYSTEM_PROMPT } from '$lib/aiDoctor/prompt';
	import { getAdapter, MissingApiKeyError } from '$lib/aiDoctor/llm';
	import { renumberCitations } from '$lib/aiDoctor/postprocess';
	import AiDoctorSettings from './AiDoctorSettings.svelte';
	import type { ChatMessage } from '$lib/aiDoctor/types';

	let input = $state('');
	let streaming = $state(false);
	let settingsOpen = $state(false);
	let errorMsg = $state<string | null>(null);
	let chatEl: HTMLDivElement | undefined = $state();
	let nearBottom = $state(true);

	let abortController: AbortController | null = null;

	// WebGPU is required for the WebLLM path; show a friendly notice if absent.
	const webgpuSupported = $derived(
		typeof navigator !== 'undefined' && 'gpu' in navigator
	);
	const showWebgpuWarning = $derived(
		$settings.provider === 'webllm' && !webgpuSupported
	);

	onMount(() => {
		// Pre-warm the chunks.json fetch (25 MB) so the first query feels faster.
		import('$lib/aiDoctor/retrieval').then((m) => m.ensureChunks?.());
		scrollToBottom();
	});

	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function renderMarkdown(text: string): string {
		let s = escapeHtml(text);
		// markdown headings: ## Foo  →  <h3>Foo</h3>
		s = s.replace(/^#{1,6}[ \t]+(.+)$/gm, '<h3>$1</h3>');
		// bold: **foo**
		s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
		// hyperlinks: [text](https://...) — runs after bold so it doesn't
		// greedily eat citations like [Source 1] (which have no URL).
		s = s.replace(
			/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener">$1</a>'
		);
		// paragraphs: blank line breaks; single \n becomes <br>
		return s
			.split(/\n{2,}/)
			.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
			.join('');
	}

	// Grab the most recent substantive assistant answer (skipping transient
	// placeholders like "Searching the index…" or "Error: …"). Used to enrich
	// the retrieval query so anaphoric follow-ups ("why was it banned?") still
	// hit topically-relevant chunks instead of going off-corpus.
	function getLastAssistantAnswer(): string | null {
		const transient = [
			'Searching the index…',
			'Generating…',
			'Fetching weights',
			'No API key set',
			'Error:'
		];
		for (let i = $messages.length - 1; i >= 0; i--) {
			const m = $messages[i];
			if (m.role !== 'assistant') continue;
			const c = m.content ?? '';
			if (transient.some((p) => c.startsWith(p))) return null;
			return c || null;
		}
		return null;
	}

	function handleScroll() {
		if (!chatEl) return;
		const slack = 80;
		nearBottom =
			chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < slack;
	}

	function scrollToBottom() {
		if (chatEl && nearBottom) {
			chatEl.scrollTop = chatEl.scrollHeight;
		}
	}

	// Auto-scroll on new tokens only if the user is near the bottom — exactly
	// the smart-autoscroll behavior we converged on for the Gradio version.
	$effect(() => {
		void $messages.length; // re-run when message count changes
		queueMicrotask(scrollToBottom);
	});
	$effect(() => {
		// also re-run when the last message's content grows during streaming
		const last = $messages[$messages.length - 1];
		void last?.content;
		queueMicrotask(scrollToBottom);
	});

	async function handleSubmit(e?: Event) {
		e?.preventDefault();
		const query = input.trim();
		if (!query || streaming) return;
		errorMsg = null;
		input = '';
		streaming = true;
		nearBottom = true; // jump to bottom on new turn

		// Capture the prior turn's answer BEFORE we append the new user/placeholder
		// messages, so the retrieval-side enrichment sees the right thing.
		const priorAnswer = getLastAssistantAnswer();

		const now = Date.now();
		appendMessage({ role: 'user', content: query, timestamp: now });
		appendMessage({
			role: 'assistant',
			content: 'Searching the index…',
			timestamp: now + 1
		});

		try {
			// 1. Retrieve. For follow-ups, prepend a truncated snippet of the
			//    prior assistant answer so the embedder/BM25 see the topical
			//    anchors that bare follow-up text usually lacks. retrieve()
			//    returns [] when the top RRF score < threshold, which makes
			//    buildUserPrompt take the GK-only branch.
			const retrievalQuery = priorAnswer
				? `Recent assistant answer: ${priorAnswer.slice(0, 1500)}\n\nLatest question: ${query}`
				: query;
			const sources = await retrieve(retrievalQuery);

			// 2. Build messages for the LLM. Prior turns flow through verbatim;
			//    the current user turn's content is swapped for the
			//    retrieval-augmented prompt so the model sees its [Source N] block.
			const history = $messages
				.slice(0, -1) // drop the streaming-placeholder assistant turn
				.map<{ role: 'user' | 'assistant'; content: string }>((m) => ({
					role: m.role,
					content: m.content
				}));
			const lastIdx = history.length - 1;
			history[lastIdx] = {
				role: 'user',
				content: buildUserPrompt(query, sources)
			};

			// 3. Adapter — throws MissingApiKeyError for BYOK without a key.
			const adapter = getAdapter($settings);

			// 4. Stream.
			abortController = new AbortController();
			updateLastAssistant('Generating…');

			let accumulated = '';
			let started = false;
			for await (const delta of adapter.stream({
				system: SYSTEM_PROMPT,
				messages: history,
				abortSignal: abortController.signal,
				onProgress: (loaded, total, phase) => {
					if (!started) {
						const pct =
							total > 0 ? ` ${Math.round((loaded / total) * 100)}%` : '';
						updateLastAssistant(`${phase}${pct}`);
					}
				}
			})) {
				if (!started) {
					started = true;
					accumulated = '';
				}
				accumulated += delta;
				updateLastAssistant(accumulated);
			}

			// 5. Final post-process: renumber [Source N] tags sequentially and
			//    strip a stray References heading if the answer was GK-only.
			const final = renumberCitations(accumulated);
			updateLastAssistant(final);

			// Stash the sources on the last assistant message in the store. We
			// don't render them in the UI (the LLM's References section is the
			// visible bibliography), but keeping them on the message keeps the
			// chatStore type contract honoured and enables future use.
			messages.update((cur) => {
				const next = [...cur];
				for (let i = next.length - 1; i >= 0; i--) {
					if (next[i].role === 'assistant') {
						next[i] = { ...next[i], sources };
						break;
					}
				}
				return next;
			});
		} catch (err) {
			if (err instanceof MissingApiKeyError) {
				updateLastAssistant(
					`No API key set for ${$settings.provider}. Open Settings to add one, or switch to WebLLM.`
				);
				settingsOpen = true;
			} else if ((err as Error)?.name === 'AbortError') {
				// user clicked Stop — leave whatever's accumulated as-is
			} else {
				const m = (err as Error)?.message ?? String(err);
				errorMsg = m;
				updateLastAssistant(`Error: ${m}`);
				console.error('[aiDoctor]', err);
			}
		} finally {
			streaming = false;
			abortController = null;
		}
	}

	function handleStop() {
		abortController?.abort();
	}

	function handleKey(e: KeyboardEvent) {
		// Enter sends, Shift+Enter adds a newline.
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="chat-root doctor-root">
	<header class="chat-header">
		<h1>The AI doctor</h1>
		<div class="header-buttons">
			<button class="ghost" onclick={() => clearChat()}>Clear chat</button>
			<button class="ghost" onclick={() => (settingsOpen = true)}>⚙ Settings</button>
		</div>
	</header>

	{#if showWebgpuWarning}
		<div class="banner warn">
			WebGPU isn't available in this browser. The local WebLLM model needs it —
			either switch to a BYOK provider in Settings, or open this page in
			Chrome / Edge / Safari 18+.
		</div>
	{/if}

	<div
		class="messages"
		bind:this={chatEl}
		onscroll={handleScroll}
		role="log"
		aria-live="polite"
	>
		{#if $messages.length === 0}
			<div class="empty">
				Ask a question — answers are drawn from a private library of papers and
				blog posts, with citations.
			</div>
		{/if}

		{#each $messages as msg (msg.timestamp)}
			<div class="msg msg-{msg.role}">
				{#if msg.role === 'assistant'}
					<div class="assistant-msg">{@html renderMarkdown(msg.content)}</div>
				{:else}
					<div class="user-msg">{msg.content}</div>
				{/if}
			</div>
		{/each}
	</div>

	<form class="composer" onsubmit={handleSubmit}>
		<textarea
			bind:value={input}
			onkeydown={handleKey}
			rows="2"
			placeholder="Ask the doctor… (Shift+Enter for newline)"
			disabled={streaming}
		></textarea>
		{#if streaming}
			<button type="button" class="stop" onclick={handleStop}>Stop</button>
		{:else}
			<button type="submit" class="send" disabled={!input.trim()}>Send</button>
		{/if}
	</form>

	{#if errorMsg}
		<div class="banner error">{errorMsg}</div>
	{/if}

	<AiDoctorSettings open={settingsOpen} onClose={() => (settingsOpen = false)} />
</div>

<style>
	.chat-root {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 110px); /* leave room for the site's <nav> */
		max-width: 880px;
		margin: 0 auto;
		padding: 0 1rem 1rem;
		box-sizing: border-box;
	}

	.chat-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.6rem 0 1rem;
		border-bottom: 1px solid #eee;
	}
	.chat-header h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 600;
	}
	.header-buttons {
		display: flex;
		gap: 0.5rem;
	}
	.ghost {
		background: transparent;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 0.35rem 0.7rem;
		font-size: 0.85rem;
		cursor: pointer;
		color: #333;
	}
	.ghost:hover {
		background: #f5f5f5;
	}

	.banner {
		padding: 0.6rem 0.8rem;
		margin: 0.6rem 0;
		border-radius: 4px;
		font-size: 0.9rem;
	}
	.warn {
		background: #fff7ed;
		color: #9a3412;
		border: 1px solid #fed7aa;
	}
	.error {
		background: #fef2f2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}
	.empty {
		color: #888;
		font-style: italic;
		text-align: center;
		margin-top: 2rem;
	}

	.msg {
		display: flex;
	}
	.msg-user {
		justify-content: flex-end;
	}
	.user-msg {
		background: #f1f3f5;
		color: #222;
		padding: 0.55rem 0.9rem;
		border-radius: 14px 14px 4px 14px;
		max-width: 75%;
		white-space: pre-wrap;
		word-wrap: break-word;
	}
	.assistant-msg {
		max-width: 100%;
		color: #1a1a1a;
	}
	/* Tighten markdown spacing inside the assistant body */
	.assistant-msg :global(p) {
		margin: 0 0 0.8em;
	}
	.assistant-msg :global(p:last-child) {
		margin-bottom: 0;
	}
	.assistant-msg :global(h3) {
		font-size: 1.05rem;
		margin: 1.2em 0 0.5em;
		font-weight: 600;
	}
	.assistant-msg :global(a) {
		color: #1e40af;
		text-decoration: underline;
	}

	.composer {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
		padding-top: 0.6rem;
		border-top: 1px solid #eee;
	}
	.composer textarea {
		flex: 1;
		resize: vertical;
		min-height: 2.6rem;
		max-height: 12rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.95rem;
		font-family: inherit;
		border: 1px solid #ccc;
		border-radius: 6px;
		box-sizing: border-box;
	}
	.composer textarea:focus {
		outline: none;
		border-color: #1e40af;
	}
	.send,
	.stop {
		padding: 0 1.2rem;
		font-size: 0.95rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-family: inherit;
	}
	.send {
		background: #1e40af;
		color: white;
	}
	.send:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.send:hover:not(:disabled) {
		background: #1d3a8a;
	}
	.stop {
		background: #b91c1c;
		color: white;
	}
	.stop:hover {
		background: #991b1b;
	}
</style>
