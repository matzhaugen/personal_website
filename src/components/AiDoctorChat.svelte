<script lang="ts">
	import { onMount } from 'svelte';
	import {
		messages,
		appendMessage,
		updateLastAssistant,
		clearChat
	} from '$lib/aiDoctor/chatStore';
	import { retrieve, type RetrievalDiagnostics } from '$lib/aiDoctor/retrieval';
	import { buildUserPrompt, SYSTEM_PROMPT } from '$lib/aiDoctor/prompt';
	import { getAdapter, HostedModelError } from '$lib/aiDoctor/llm';
	import { renumberCitations } from '$lib/aiDoctor/postprocess';
	import type { ChatMessage } from '$lib/aiDoctor/types';

	let input = $state('');
	let streaming = $state(false);
	let errorMsg = $state<string | null>(null);
	let chatEl: HTMLDivElement | undefined = $state();
	let nearBottom = $state(true);

	let abortController: AbortController | null = null;

	onMount(() => {
		// Pre-warm the chunk metadata fetch so the first query feels faster. The
		// bodies are not fetched here — they're pulled per query by byte range.
		import('$lib/aiDoctor/retrieval').then((m) => m.ensureChunkMeta?.());
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
		// autolinks: <https://example.com>  — model commonly emits References
		// entries in this form. Match the entity-encoded form since escapeHtml
		// has already converted < / > to &lt; / &gt;.
		s = s.replace(
			/&lt;(https?:\/\/[^\s<>]+?)&gt;/g,
			'<a href="$1" target="_blank" rel="noopener">$1</a>'
		);
		// hyperlinks: [text](https://...) — runs after bold so it doesn't
		// greedily eat citations like [Source 1] (which have no URL).
		s = s.replace(
			/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener">$1</a>'
		);
		// bare URL fallback. What stops this re-linking the URLs already wrapped
		// above is the required leading (^|[\s(]): inside <a href="…"> the
		// character before the URL is a quote, and before the anchor text it is
		// '>', so neither position matches.
		//
		// Match greedily, then strip trailing punctuation. A lazy match with a
		// lookahead cannot work here — the lookahead set has to contain '.' to
		// handle a URL ending a sentence, but then the first dot of the hostname
		// satisfies it and every reference renders as the link "https://www".
		s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>"']+)/g, (_m, lead, url) => {
			// Trailing '.' / ')' etc. are almost always sentence punctuation or a
			// closing wrapper, not part of the URL.
			const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? '';
			const href = trailing ? url.slice(0, -trailing.length) : url;
			return `${lead}<a href="${href}" target="_blank" rel="noopener">${href}</a>${trailing}`;
		});
		// paragraphs: blank line breaks; single \n becomes <br>
		return s
			.split(/\n{2,}/)
			.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
			.join('');
	}

	// Grab the most recent substantive assistant answer (skipping transient
	// placeholders like "Searching the index…" or "Error: …"). Offered to
	// retrieval as optional context for anaphoric follow-ups ("why was it
	// banned?"); retrieval uses it only when the question can't stand alone.
	function getLastAssistantAnswer(): string | null {
		const transient = ['Searching the index…', 'Generating…', 'Error:'];
		for (let i = $messages.length - 1; i >= 0; i--) {
			const m = $messages[i];
			if (m.role !== 'assistant') continue;
			const c = m.content ?? '';
			if (transient.some((p) => c.startsWith(p))) return null;
			return c || null;
		}
		return null;
	}

	// Retrieval tuning log — DEV ONLY, and deliberately so: the disclaimer tells
	// visitors nothing they type is stored, and this is how that stays true.
	// import.meta.env.DEV is a compile-time constant, so in a production build
	// this whole call is dropped by dead-code elimination and the endpoint 404s
	// besides. Records land in ./doctor-queries.jsonl (gitignored).
	function logRetrieval(d: RetrievalDiagnostics) {
		if (!import.meta.env.DEV) return;
		fetch('/api/doctor-log', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(d)
		}).catch(() => {
			/* logging must never break a chat turn */
		});
	}

	// Which vendor served the answer. Dev-only for the same reason as above, and
	// worth recording separately: the two backends run genuinely different models
	// (gpt-oss-120b vs llama-3.1-8b-instant), so "this answer was bad" is only
	// actionable if you know which one wrote it.
	function logProvider(id: string) {
		if (!import.meta.env.DEV) return;
		console.info('[aiDoctor] answered by:', id);
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
			// 1. Retrieve. The prior answer is handed over as context rather than
			//    pre-glued to the query: retrieval decides per question whether it
			//    needs it, because prepending it unconditionally makes a
			//    self-contained question retrieve the PREVIOUS topic (see
			//    SELF_CONTAINED_COSINE in retrieval.ts). retrieve() returns [] when
			//    nothing clears the relevance floor, which makes buildUserPrompt
			//    take the "not in the library" branch.
			const sources = await retrieve(query, { priorAnswer, onDiagnostics: logRetrieval });

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

			// 3. Adapter — hosted model via /api/doctor-chat, which picks the vendor
			//    (Cerebras, then Groq) server-side. May throw HostedModelError
			//    (not configured / daily cap / rate limit) once ALL of them fail.
			const adapter = getAdapter();

			// 4. Stream.
			abortController = new AbortController();
			updateLastAssistant('Generating…');

			let accumulated = '';
			for await (const delta of adapter.stream({
				system: SYSTEM_PROMPT,
				messages: history,
				abortSignal: abortController.signal,
				onProvider: logProvider
			})) {
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
			const m = (err as Error)?.message ?? String(err);
			if ((err as Error)?.name === 'AbortError') {
				// user clicked Stop — leave whatever's accumulated as-is
			} else if (err instanceof HostedModelError) {
				// message is already user-friendly — show it in place of the answer
				updateLastAssistant(m);
			} else {
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
		</div>
	</header>

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
