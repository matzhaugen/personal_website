import { imports } from "$lib/handle-markdown"
export function get({ params }) {

    const {url} = params;
    const key = `./posts/${url}.md`
    let body = JSON.stringify({metadata: imports[key].metadata, ...imports[key].default.render()})

    return {body}
}