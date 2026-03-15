

<script lang="ts">
  import { isAuthenticated } from '$lib/authStore';
  import { goto } from '$app/navigation';

  interface Props {
    title?: string;
    authors?: string;
    date?: string;
    hidden?: boolean;
    children?: any;
  }

  let {
    title,
    authors,
    date,
    hidden,
    children
  }: Props = $props();

  $effect(() => {
    if (hidden && !$isAuthenticated) {
      goto('/');
    }
  });
</script>

{#if !hidden || $isAuthenticated}
<h1 class="section-header">{title}</h1>
    <div class="metadata"><i>{authors}  – {date}</i></div>
{#if children}{@render children()}{:else}
  <!-- the mdsvex content will be slotted in here -->
{/if}
{/if}

<style>
    article {
        padding: 20px;
    }
    .section-header {
        text-align: center;
        line-height: 3rem;
    }
    .metadata {
        text-align: center;
    }
    
</style>