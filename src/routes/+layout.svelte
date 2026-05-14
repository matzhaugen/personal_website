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

  const MAX_ATTEMPTS = 3;
  const LOCKOUT_MS = 5 * 60 * 1000;

  function getAttempts(): number {
    return parseInt(localStorage.getItem('auth_attempts') ?? '0', 10);
  }
  function getLockoutUntil(): number {
    return parseInt(localStorage.getItem('auth_lockout_until') ?? '0', 10);
  }
  function isLockedOut(): boolean {
    return Date.now() < getLockoutUntil();
  }

  let lockoutSecondsLeft = $state(0);
  let lockoutTimer: ReturnType<typeof setInterval> | null = null;

  function startLockoutCountdown() {
    if (lockoutTimer) clearInterval(lockoutTimer);
    lockoutTimer = setInterval(() => {
      const remaining = Math.ceil((getLockoutUntil() - Date.now()) / 1000);
      if (remaining <= 0) {
        lockoutSecondsLeft = 0;
        clearInterval(lockoutTimer!);
        lockoutTimer = null;
      } else {
        lockoutSecondsLeft = remaining;
      }
    }, 1000);
    lockoutSecondsLeft = Math.ceil((getLockoutUntil() - Date.now()) / 1000);
  }

  function handleSunClick() {
    if (!$isAuthenticated) {
      if (isLockedOut()) startLockoutCountdown();
      showPasswordPrompt = true;
    } else {
      isAuthenticated.set(false);
    }
  }

  async function handlePasswordSubmit() {
    if (isLockedOut()) return;

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      const result = await response.json();
      passwordInput = '';

      if (result.success) {
        localStorage.removeItem('auth_attempts');
        localStorage.removeItem('auth_lockout_until');
        isAuthenticated.set(true);
        showPasswordPrompt = false;
      } else {
        const attempts = getAttempts() + 1;
        localStorage.setItem('auth_attempts', String(attempts));
        if (attempts >= MAX_ATTEMPTS) {
          localStorage.setItem('auth_lockout_until', String(Date.now() + LOCKOUT_MS));
          localStorage.setItem('auth_attempts', '0');
          startLockoutCountdown();
        }
      }
    } catch {
      passwordInput = '';
    }
  }

  function closePasswordPrompt() {
    showPasswordPrompt = false;
    passwordInput = '';
  }
</script>

<GoogleAnalytics properties={[ 'G-EQKEBHS9KL' ]} />

<nav>
  <a href="/">Home</a>
  <a href="/research">Research</a>
  <a href="/links">Links</a>
  <a href="/books">Books</a>
  <a href="/software">Software</a> 
  <a href="/MatzHaugenResume.pdf" target="_blank" rel="noopener">CV</a>
  <a href="/blog">Blog</a> 
  <a href="/satellites">Satellites</a>
  <a href="/law">Law</a>
  {#if $isAuthenticated}<a href="/law/secret">Secret Law</a>{/if}
  {#if $isAuthenticated}<a href="/doctor">AI Doctor</a>{/if}
  <a href="/pregnancy">Pregnancy</a>
  <a href="/economics">Economics</a>
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
      {#if lockoutSecondsLeft > 0}
        <p class="lockout-msg">Too many incorrect attempts. Try again in {Math.floor(lockoutSecondsLeft / 60)}:{String(lockoutSecondsLeft % 60).padStart(2, '0')}.</p>
      {:else}
        <p>You must know the password to proceed</p>
        {#if getAttempts() > 0}
          <p class="attempts-msg">{MAX_ATTEMPTS - getAttempts()} attempt{MAX_ATTEMPTS - getAttempts() === 1 ? '' : 's'} remaining</p>
        {/if}
      {/if}
      <input
        type="password"
        bind:value={passwordInput}
        placeholder="Enter password..."
        onkeydown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
        disabled={lockoutSecondsLeft > 0}
        autofocus
      />
      <div class="password-buttons">
        <button onclick={handlePasswordSubmit} disabled={lockoutSecondsLeft > 0}>Submit</button>
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

  .lockout-msg {
    color: #dc2626;
    font-weight: 500;
  }

  .attempts-msg {
    color: #d97706;
    font-size: 0.85rem;
    margin-top: -0.5rem;
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

