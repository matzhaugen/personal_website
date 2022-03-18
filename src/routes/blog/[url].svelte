<script context="module">
    // For pagination see https://meow.dev/tutorials/sveltekit-pagination
    // Or infinity scroll https://rodneylab.com/sveltekit-infinite-scroll/
    export const prerender = true;
    export async function load({fetch, page}) {
      
      if (page.params.url.endsWith(".md")) {
        return {
          status: 301,
          redirect: "/blog/" + page.params.url.replace(".md","")
        }
      }
      if (page.params.url.endsWith("vite_ping")) {
        return {
          status: 301,
          redirect: "/blog/"
        }
      }

      const post = await fetch(`${page.params.url}.json`)
      .then((r) => r.json())
        // .then(res => res.text())
        // .then(text => console.log(text))        
      return {
          props: {post}
      }
    }
</script>

<svelte:head>
 <title>{post.metadata.title}</title>
 <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.15.0/dist/katex.min.css" integrity="sha384-RZU/ijkSsFbcmivfdRBQDtwuwVqK7GMOw6IMvKyeWL2K5UAlyp6WonmB8m7Jd0Hn" crossorigin="anonymous">
</svelte:head>


<script>
    export let post;
</script>
  
<article>
    <h1 class="section-header">{post.metadata.title}</h1>
    <div class="metadata"><i>{post.metadata.authors}  – {post.metadata.date}</i></div>
    {@html post.html}
</article>

<style>
    article {
        padding: 20px;
    }
    .section-header {
        text-align: center;
        line-height: 2rem;
    }
    .metadata {
        text-align: center;
    }
</style>