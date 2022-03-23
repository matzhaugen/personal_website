<script>
  import { GoogleAnalytics } from '@beyonk/svelte-google-analytics'
</script>

<GoogleAnalytics properties={[ 'G-EQKEBHS9KL' ]} />

<body>
<nav>
  <a href="/">Home</a>
  <a href="/research">Research</a>
  <a href="/links">Links</a>
  <a href="/software">Software</a> 
  <a href="/MatzHaugenResume.pdf" download="MatzHaugenResume">CV</a>
  <a href="/blog">Blog</a> 
  <a href="/satellites">Satellites</a> 
</nav>
<slot></slot>
</body>

