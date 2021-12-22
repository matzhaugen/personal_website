
import fs from 'fs';
// import files with pattern
import glob from "glob";
// parse front matter and body of markdown
import fm from "front-matter";
// parse body to html
import {marked} from "marked"
/**
 * import all markdown files in specified path, extract front matter and convert to html
 * @param {string} markdownPath path to folder containing the markdown files (ends on /)
 * @returns [{path, attributes, body}]
 */
export function importMarkdowns(markdownPath) {
    let fileNames = glob.sync(`${markdownPath}*.md`);
    return fileNames.map((path) => convertMarkdown(path));
}

/**
 * convert markdown to object with attributes and html
 * @param {string} path path to file
 * @returns 
 */
export function convertMarkdown(path) {
    // read file
    // try {
    //   const arrayOfFiles = fs.readdirSync("src/")
    //   console.log(arrayOfFiles)
    // } catch(e) {
    //   console.log(e)
    // }
    let file = fs.readFileSync(path, 'utf8');
    // extract frontmatter and body with the front-matter package
    let content = fm(file);
    const html = marked(content.body);
    return { path, attributes: content.attributes, html: html};
}

export function convertToPostPreview(object) {
    const url = object.path.replace(".md","").replace("src/posts/", "");
    return {...object.attributes, url};
}