<script context="module">
    // For pagination see https://meow.dev/tutorials/sveltekit-pagination
    // Or infinity scroll https://rodneylab.com/sveltekit-infinite-scroll/
    export const prerender = false
    export async function load({fetch, page}) {
      slug = page.params.slug.replace(".md","")
      console.log(slug)
      if (slug == "/blog/excess-mort-en") {
        return {
            status: 301,
            redirect: "https://electromagneticlife.substack.com/p/excess-mortality-compared-to-vaccination"
        }
      }
      return {
          status: 301,
          redirect: "/blog/" + page.params.slug.replace(".md","")
      }
    }
</script>