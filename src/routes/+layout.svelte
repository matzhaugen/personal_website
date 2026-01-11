<script lang="ts">
  import { GoogleAnalytics } from '@beyonk/svelte-google-analytics'
  import { isAuthenticated } from '$lib/authStore';
  
  interface Props {
    children?: any;
  }

  let { children }: Props = $props();
  
  // Password system for hidden blog posts
  let showPasswordPrompt = $state(false);
  let passwordInput = $state('');
  
  function handleSunClick() {
    if (!$isAuthenticated) {
      showPasswordPrompt = true;
    } else {
      // If already authenticated, toggle authentication
      isAuthenticated.set(false);
    }
  }
  
  async function handlePasswordSubmit() {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: passwordInput }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        isAuthenticated.set(true);
        showPasswordPrompt = false;
        passwordInput = '';
      } else {
        alert(result.message || 'Incorrect password. Please try again.');
        passwordInput = '';
      }
    } catch (error) {
      alert('Error connecting to server. Please try again.');
      passwordInput = '';
    }
  }
  
  function closePasswordPrompt() {
    showPasswordPrompt = false;
    passwordInput = '';
  }
</script>

<!-- <GoogleAnalytics properties={[ 'G-EQKEBHS9KL' ]} /> -->

<nav>
  <a href="/">Home</a>
  <a href="/research">Research</a>
  <a href="/links">Links</a>
  <a href="/software">Software</a> 
  <a href="/MatzHaugenResume.pdf" target="_blank" download="MatzHaugenResume.pdf">CV</a>
  <a href="/blog">Blog</a> 
  <a href="/satellites">Satellites</a>
  <a href="/law">Law</a>
  <!-- <a href="/stocks">Stocks</a> -->
  <!-- <a href="/covid-papers">Covid Papers</a> -->
  <img 
    id="sun" 
    src="/sun.svg" 
    alt="a" 
    width="3%" 
    height="2%" 
    style="vertical-align:middle;margin:5px 5px 6px 2px;cursor:pointer;" 
    onclick={handleSunClick}
    title={$isAuthenticated ? "Click to hide hidden posts" : "Click to access hidden posts"}
  >
</nav>

<main>
  {#if children}
    {@render children()}
  {/if}
</main>

<!-- Password Prompt Modal -->
{#if showPasswordPrompt}
  <div class="password-modal-overlay" onclick={closePasswordPrompt}>
    <div class="password-modal" onclick={(e) => e.stopPropagation()}>
      <h3>Enter the sun</h3>
      <p>You must know the password to proceed</p>
      <input 
        type="password" 
        bind:value={passwordInput}
        placeholder="Enter password..."
        onkeydown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
        autofocus
      />
      <div class="password-buttons">
        <button onclick={handlePasswordSubmit}>Submit</button>
        <button onclick={closePasswordPrompt}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- Authentication Status Indicator -->
{#if $isAuthenticated}
  <div class="auth-indicator" title="Hidden posts are visible">
    🔓
  </div>
{/if}

<style>
  .password-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .password-modal {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 400px;
    width: 90%;
  }
  
  .password-modal h3 {
    margin-top: 0;
    color: #333;
  }
  
  .password-modal p {
    color: #666;
    margin-bottom: 1rem;
  }
  
  .password-modal input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    margin-bottom: 1rem;
    box-sizing: border-box;
  }
  
  .password-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  
  .password-buttons button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .password-buttons button:first-child {
    background-color: #007bff;
    color: white;
  }
  
  .password-buttons button:first-child:hover {
    background-color: #0056b3;
  }
  
  .password-buttons button:last-child {
    background-color: #6c757d;
    color: white;
  }
  
  .password-buttons button:last-child:hover {
    background-color: #545b62;
  }
  
  .auth-indicator {
    position: fixed;
    top: 20px;
    right: 20px;
    font-size: 1.5rem;
    z-index: 999;
    background: rgba(255, 255, 255, 0.9);
    padding: 0.5rem;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>

