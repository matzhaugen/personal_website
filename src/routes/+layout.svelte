<script>
  import { GoogleAnalytics } from '@beyonk/svelte-google-analytics'
  import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
  beforeNavigate(async ({ to, from, cancel }) => {

    if (to !== null && from !== "/stocks") {
      if (to.route.id == "/stocks" || to.route.id == null) {
        var password = prompt("What is Ra's law?");
        if (password != "1") {
            cancel()
        }
      }
    }

  });
</script>

<!-- <GoogleAnalytics properties={[ 'G-EQKEBHS9KL' ]} /> -->

<body>
<nav>
  <a href="/">Home</a>
  <a href="/research">Research</a>
  <a href="/links">Links</a>
  <a href="/software">Software</a> 
  <!-- <a href="/MatzHaugenResume.pdf" download="MatzHaugenResume">CV</a> -->
  <a href="/blog">Blog</a> 
  <a href="/satellites">Satellites</a>
  <!-- <a href="/covid-papers">Covid Papers</a> -->
  <a href="/stocks"><img id="sun" src="/sun.svg" alt="a" width="3%" height="2%" style="vertical-align:middle;margin:5px 5px 6px 2px"></a>
</nav>
<slot></slot>
</body>

