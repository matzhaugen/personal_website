<script lang="ts">
	import type { RetrievalResult } from '$lib/aiDoctor/types';

	interface Props {
		sources: RetrievalResult[];
	}
	let { sources }: Props = $props();

	let expanded = $state(false);
</script>

{#if sources.length > 0}
	<div class="sources">
		<button class="toggle" onclick={() => (expanded = !expanded)}>
			{expanded ? '▾' : '▸'} {sources.length} source{sources.length === 1 ? '' : 's'}
		</button>
		{#if expanded}
			<ol>
				{#each sources as { chunk }, i}
					<li>
						<div class="head">
							<span class="num">[Source {i + 1}]</span>
							<span class="label">{chunk.source_type === 'paper' ? '📄' : '📝'}</span>
							<span class="title">{chunk.doc_title}</span>
						</div>
						<div class="meta">
							Section: {chunk.section_heading}
							{#if chunk.url}
								· <a href={chunk.url} target="_blank" rel="noopener">link</a>
							{/if}
						</div>
						<div class="snippet">
							{chunk.raw_text.slice(0, 300)}{chunk.raw_text.length > 300 ? '…' : ''}
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
{/if}

<style>
	.sources {
		font-size: 0.85rem;
		margin-bottom: 0.6rem;
		border-left: 3px solid #ccc;
		padding-left: 0.7rem;
	}
	.toggle {
		background: none;
		border: none;
		padding: 0;
		color: #555;
		cursor: pointer;
		font-size: 0.85rem;
	}
	ol {
		margin: 0.4rem 0 0;
		padding-left: 1.2rem;
	}
	li { margin-bottom: 0.7rem; }
	.head { font-weight: 500; }
	.num { color: #888; margin-right: 0.3rem; }
	.title { margin-left: 0.3rem; }
	.meta { color: #777; font-size: 0.8rem; }
	.snippet {
		color: #555;
		font-size: 0.82rem;
		margin-top: 0.2rem;
		white-space: pre-wrap;
	}
</style>
