<script lang="ts">
  import { isAuthenticated } from '$lib/authStore';
  import { goto } from '$app/navigation';

  interface Props {
    children?: any;
  }

  let { children }: Props = $props();

  $effect(() => {
    if (!$isAuthenticated) {
      goto('/');
    }
  });
</script>

{#if $isAuthenticated}
  {@render children()}
{/if}
