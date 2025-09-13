<script>

  let {
    title,
    description,
    url,
    date
  } = $props();
</script>


<div class="post-card">
<a href={url}>
  <h1>{title}</h1>
</a>
<p><i>{date}:</i> {description}</p>
</div>

<style>   
    h1 {
        line-height: 2.4rem;
    }
    a {
        font-weight: 100;
        font-size: 15px;
        color: black;
        text-decoration: none;
    }

    a:hover {
        color: gray;
    }

    .post-card {
      padding: 15px;
    }

</style>