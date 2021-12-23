import {posts} from "$lib/handle-markdown"
// Import the markdown files for each post
// load all markdown files from the posts directory

export function get() {
    // convert the markdown to the required format
    // let posts = postFiles.map((file) => convertToPostPreview(file));
    // stringify to give it as a result of the get command
    // const myposts = convertMarkdown()
    let body = JSON.stringify(posts);
    
    return {body}
}