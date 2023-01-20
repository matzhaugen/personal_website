import { error } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
export function load({ params }) {
  if (params.slug == "excess-mort-en") {
    throw redirect(307, 'https://electromagneticlife.substack.com/p/excess-mortality-compared-to-vaccination');
    }
  throw error(404, 'Not found');
}