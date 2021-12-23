<script context="module">
    // export const ssr = false;

    export const prerender = true;
  // load data
  export async function load({fetch}) {
    // request data from endpoint
    const posts = await fetch("/blog/blog.json").then((r) => r.json())

    // assign it to the variable
    return {
        props: {posts}
    }
  }
</script>

<script>    
    import { onMount } from 'svelte';

    onMount(() => {
        let cachedLanguage = localStorage.getItem(`language`)
        if (!!cachedLanguage) {
            language = cachedLanguage
        } else {
            localStorage.setItem(`language`, language)
        }
    })
    let language = "English";
    function getOtherLanguage(language) {
        if (language === "Norwegian") {
            return "English"
        } else {
            return "Norwegian"
        }
    }

    function switchLanguage() {
        language = getOtherLanguage(language);
        localStorage.setItem(`language`, language)
    }
    import PostCard from "/src/components/post-card.svelte";
    export let posts;
</script>

{#if typeof localStorage !== `undefined`}
    <div class="submenu">
        <div on:click={switchLanguage}>{language}</div>
    </div>
    {#each posts as post} 
        {#if post.language === getOtherLanguage(language)}
            <PostCard title={post.title} description={post.description} url={post.url} date={post.date}/>
        {/if}
    {/each}
{/if}

{#if false}<slot></slot>{/if}

<style type="text/css">
    .submenu {
        text-align: right;
        color: #b48608; text-decoration: none;

    }

    .submenu:hover {
        color: #e5a400; 
        cursor: pointer;
    }

</style>