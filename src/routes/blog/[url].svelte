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

      const post = await fetch(`${page.params.url}.json`)
      .then((r) => r.json())
        // .then(res => res.text())
        // .then(text => console.log(text))        
      return {
          props: {post}
      }
    }
</script>


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

    figure {
      border: 1px #cccccc solid;
      padding: 4px;
      margin: auto;
    }
</style>