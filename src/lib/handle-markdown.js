// Import the markdown files for each post
const imports = import.meta.globEager('./posts/*.md');

const posts = [];
// console.log(imports['./posts/covid-en.md'])
for (const mymd in imports) {
    const post = imports[mymd]
    posts.push({
        url: mymd.replace("./posts", "/blog").replace(".md", ""),
        ...post.metadata,
        ...post.default.render()
    });
}
export {posts, imports};
