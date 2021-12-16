<script context="module">
    // For pagination see https://meow.dev/tutorials/sveltekit-pagination
    // Or infinity scroll https://rodneylab.com/sveltekit-infinite-scroll/
    export const prerender = true
    export async function load({fetch, page}) {
      // request post from [url].json.js endpoint
      const post = await fetch(`${page.params.url}.json`).then((r) => r.json())
  
      return {
          props: {post}
      }
    }
</script>


<script>
    export let post;
</script>
  
<article>
    <h1 class="section-header">{post.attributes.title}</h1>
    <div class="metadata"><i>{post.attributes.authors}  – {post.attributes.date}</i></div>
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
    .math-field {
        text-align: center;
    }
    .test {
        text-align: center;
    }
</style>