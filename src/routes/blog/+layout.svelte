

<script lang="ts">
  interface Props {
    title?: string;
    authors?: string;
    date?: string;
    children?: any;
  }

  let {
    title,
    authors,
    date,
    children
  }: Props = $props();
</script>

<h1 class="section-header">{title}</h1>
    <div class="metadata"><i>{authors}  – {date}</i></div>
{#if children}{@render children()}{:else}
  <!-- the mdsvex content will be slotted in here -->
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