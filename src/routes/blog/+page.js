
export function load({ params }) {
    // convert the markdown to the required format
    // let posts = postFiles.map((file) => convertToPostPreview(file));
    // stringify to give it as a result of the get command
    // const myposts = convertMarkdown()
    const files = import.meta.glob('./**/*.md', { eager: true });
    var posts = []
    for (const mymd in files) {
        const post = files[mymd]
        
        posts.push({
            url: mymd.replace("/+page.md", "").replace(".", "/blog"),
            ...post.metadata,
        });

    }

    return {posts}
}