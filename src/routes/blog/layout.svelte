

<script>
  export let title;
  export let authors;
  export let date;
</script>

<h1 class="section-header">{title}</h1>
    <div class="metadata"><i>{authors}  – {date}</i></div>
<slot>
  <!-- the mdsvex content will be slotted in here -->
</slot>

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