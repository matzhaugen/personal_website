<script context="module">
  // load data
  export async function load({fetch}) {
    // request data from endpoint
    const posts = await fetch("/blog.json").then((r) => r.json())

    // assign it to the variable
    return {
        props: {posts}
    }
  }
</script>

<script>    
    import PostCard from "/src/components/post-card.svelte";
    export let posts;
</script>

{#each posts as post}
    <PostCard {...post}/>
{/each}