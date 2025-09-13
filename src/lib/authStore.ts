// Simple authentication store for hidden blog posts
import { writable } from 'svelte/store';

// Check if user was previously authenticated
const initialAuthState = typeof window !== 'undefined' 
  ? localStorage.getItem('blog_authenticated') === 'true'
  : false;

export const isAuthenticated = writable(initialAuthState);

// Subscribe to changes and update localStorage
if (typeof window !== 'undefined') {
  isAuthenticated.subscribe((value) => {
    if (value) {
      localStorage.setItem('blog_authenticated', 'true');
    } else {
      localStorage.removeItem('blog_authenticated');
    }
  });
}
