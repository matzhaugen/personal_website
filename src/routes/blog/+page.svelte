<script context="module">

    export const prerender = true;
    
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
    export let data

</script>

<svelte:head>
 <title>Blog</title>
</svelte:head>

<h1>Blog</h1>

{#if typeof localStorage !== `undefined`}
    <div class="submenu">
        <div role="presentation" on:click={switchLanguage}>{language}</div>
    </div>
    {#each data.posts as post} 
        {#if post.language === getOtherLanguage(language) && ! post.hidden}
            <PostCard title={post.title} description={post.description} url={post.url} date={post.date}/>
        {/if}
    {/each}
{/if}

{#if false}<slot></slot>{/if}

<style type="text/css">
    .submenu {
        text-align: right;
        margin-right: 5%;
        color: #b48608; text-decoration: none;

    }

    .submenu:hover {
        color: #e5a400; 
        cursor: pointer;
    }

</style>