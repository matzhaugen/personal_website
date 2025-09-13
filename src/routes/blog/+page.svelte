<script module>

    export const prerender = true;
    
</script>

<script lang="ts">    
    import { onMount } from 'svelte';
    import { isAuthenticated } from '$lib/authStore';
    import PostCard from "../../components/post-card.svelte";
    
    onMount(() => {
        let cachedLanguage = localStorage.getItem(`language`)
        if (!!cachedLanguage) {
            language = cachedLanguage
        } else {
            localStorage.setItem(`language`, language)
        }
    })
    let language = $state("English");
    function getOtherLanguage(language: string): string {
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
    
    interface Props {
        data: any;
        children?: any;
    }
    
    let { data, children }: Props = $props();

</script>

<svelte:head>
 <title>Blog</title>
</svelte:head>

<h1>Blog</h1>

{#if typeof localStorage !== `undefined`}
    <div class="submenu">
        <div role="presentation" onclick={switchLanguage}>{language}</div>
    </div>
    {#each data.posts as post} 
        {#if post.language === getOtherLanguage(language) && (!$isAuthenticated ? !post.hidden : true)}
            <PostCard title={post.title} description={post.description} url={post.url} date={post.date}/>
        {/if}
    {/each}
{/if}

{#if false}{@render children?.()}{/if}

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