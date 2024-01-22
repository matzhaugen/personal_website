import { error } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
export function load({ params }) {
  if (params.slug == "excess-mort-en") {
    redirect(307, 'https://electromagneticlife.substack.com/p/excess-mortality-compared-to-vaccination');
    }
  error(404, 'Not found');
}