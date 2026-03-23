
<script lang="ts">
  import { isAuthenticated } from '$lib/authStore';
  import { goto, afterNavigate } from '$app/navigation';
  import { onMount, tick } from 'svelte';

  interface Props {
    title?: string;
    authors?: string;
    date?: string;
    hidden?: boolean;
    children?: any;
  }

  let { title, authors, date, hidden, children }: Props = $props();

  $effect(() => {
    if (hidden && !$isAuthenticated) {
      goto('/');
    }
  });

  type Heading = { id: string; text: string; level: number };
  let headings = $state<Heading[]>([]);
  let activeId = $state('');
  let pinned = $state(false);
  let contentEl = $state<HTMLElement | undefined>(undefined);
  let tocEl = $state<HTMLElement | undefined>(undefined);
  let collected: Heading[] = [];

  function togglePin(e: MouseEvent) {
    e.stopPropagation();
    pinned = !pinned;
  }

  function updateActive() {
    const threshold = window.scrollY + 80;
    let current = collected[0]?.id ?? '';
    for (const h of collected) {
      const el = document.getElementById(h.id);
      if (el && el.getBoundingClientRect().top + window.scrollY <= threshold) {
        current = h.id;
      }
    }
    activeId = current;
  }

  async function scanHeadings() {
    await tick(); // wait for new page content to render
    if (!contentEl) return;
    const els = contentEl.querySelectorAll('h2, h3');
    collected = [];
    for (const el of els) {
      if (!el.id) {
        el.id = el.textContent!
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      collected.push({ id: el.id, text: el.textContent!, level: parseInt(el.tagName[1]) });
    }
    headings = collected;
    pinned = false;
    updateActive();
  }

  afterNavigate(scanHeadings);

  onMount(() => {
    scanHeadings();
    window.addEventListener('scroll', updateActive, { passive: true });

    function onDocClick(e: MouseEvent) {
      if (pinned && !tocEl?.contains(e.target as Node)) pinned = false;
    }
    document.addEventListener('click', onDocClick);

    return () => {
      window.removeEventListener('scroll', updateActive);
      document.removeEventListener('click', onDocClick);
    };
  });
</script>

{#if !hidden || $isAuthenticated}
  {#if headings.length > 0}
    <aside class="toc-container" class:pinned bind:this={tocEl}>
      <!-- Dash strip -->
      <div class="dash-track" onclick={togglePin} role="button" tabindex="0"
           onkeydown={(e) => e.key === 'Enter' && togglePin(e as any)}>
        {#each headings as h}
          <span class="dash" class:active={activeId === h.id} class:sub={h.level === 3}>—</span>
        {/each}
      </div>

      <!-- Panel: appears on hover or when pinned -->
      <div class="toc-panel">
        <p class="toc-title">Contents</p>
        <nav>
          {#each headings as h}
            <a
              href="#{h.id}"
              class="toc-link level-{h.level}"
              class:active={activeId === h.id}
              onclick={(e) => e.stopPropagation()}
            >{h.text}</a>
          {/each}
        </nav>
      </div>
    </aside>
  {/if}

  <article bind:this={contentEl}>
    <h1 class="section-header">{title}</h1>
    <div class="metadata"><i>{authors}  – {date}</i></div>
    {#if children}{@render children()}{/if}
  </article>
{/if}

<style>
  /* ── TOC strip (fixed in left margin) ───────────────────────────────────── */
  .toc-container {
    display: none;
  }

  @media (min-width: 768px) {
    .toc-container {
      display: flex;
      align-items: center;
      position: fixed;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      z-index: 200;
      /* Extend hover area to cover gap between strip and panel */
      padding-right: 1rem;
    }
  }

  /* Dash markers */
  .dash-track {
    display: flex;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    padding: 8px 10px 8px 8px;
  }

  .dash {
    display: block;
    font-size: 14px;
    line-height: 1;
    color: #ccc;
    transition: color 0.12s;
    user-select: none;
  }

  .dash.sub { font-size: 11px; }

  .dash.active { color: #444; }

  .dash-track:hover .dash { color: #888; }
  .dash-track:hover .dash.active { color: #111; }

  /* Panel */
  .toc-panel {
    position: absolute;
    left: calc(100% - 1rem);
    top: 50%;
    transform: translateY(-50%);
    width: 220px;
    max-height: 80vh;
    overflow-y: auto;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 14px 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    font-family: sans-serif;
    font-size: 13px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }

  .toc-container:hover .toc-panel,
  .toc-container.pinned .toc-panel {
    opacity: 1;
    pointer-events: auto;
  }

  .toc-title {
    margin: 0 0 0.6rem;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #999;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .toc-link {
    display: block;
    padding: 4px 8px;
    border-radius: 4px;
    color: #666;
    text-decoration: none;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.1s, color 0.1s;
  }

  .toc-link.level-3 {
    padding-left: 18px;
    font-size: 12px;
    color: #999;
  }

  .toc-link:hover {
    background: #f0f0f0;
    color: #111;
  }

  /* Strong active highlight */
  .toc-link.active {
    background: #e8e8e8;
    color: #000;
    font-weight: 600;
  }

  /* ── Article ─────────────────────────────────────────────────────────────── */
  article {
    min-width: 0;
  }

  .section-header {
    text-align: center;
    line-height: 3rem;
  }

  .metadata {
    text-align: center;
  }
</style>
