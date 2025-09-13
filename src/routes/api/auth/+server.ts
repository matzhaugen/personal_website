import { json } from '@sveltejs/kit';
import { BLOG_PASSWORD } from '$env/static/private';

export async function POST({ request }) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return json({ success: false, message: 'Password required' }, { status: 400 });
    }
    
    if (password === BLOG_PASSWORD) {
      return json({ success: true, message: 'Authentication successful' });
    } else {
      return json({ success: false, message: 'Incorrect password' }, { status: 401 });
    }
  } catch (error) {
    return json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
