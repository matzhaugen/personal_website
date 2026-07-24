
export function load({ params }) {
    // convert the markdown to the required format
    // let posts = postFiles.map((file) => convertToPostPreview(file));
    // stringify to give it as a result of the get command
    // const myposts = convertMarkdown()
    const files = import.meta.glob('./**/*.md', { eager: true });
    var posts = []
    for (const mymd in files) {
        const post = files[mymd] as any;
        
        posts.push({
            url: mymd.replace("/+page.md", "").replace(".", "/blog"),
            ...post.metadata,
        });

    }

    // Sort by date, most recent first; posts without a valid date go last.
    posts.sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : NaN;
        const tb = b.date ? new Date(b.date).getTime() : NaN;
        return (isNaN(tb) ? -Infinity : tb) - (isNaN(ta) ? -Infinity : ta);
    });

    return {posts}
}