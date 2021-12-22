<script context="module">
    // For pagination see https://meow.dev/tutorials/sveltekit-pagination
    // Or infinity scroll https://rodneylab.com/sveltekit-infinite-scroll/
    export const prerender = true
    export async function load({fetch, page}) {
      return {
          status: 301,
          redirect: "/blog/" + page.params.slug
      }
    }
</script>