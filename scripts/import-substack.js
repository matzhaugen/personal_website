#!/usr/bin/env node
/**
 * Import a Substack post into this site as a blog post.
 *
 *   node scripts/import-substack.js <url> [options]
 *
 * Reads the current Firefox cookie jar so that subscriber-only posts come down
 * in full, converts the article body to markdown, and mirrors the layout the
 * existing posts use:
 *
 *   src/routes/blog/<slug>/+page.md    the post
 *   static/<slug>/<image>              the images, referenced as /<slug>/<image>
 *
 * Options:
 *   --slug <name>       Output slug (default: the slug in the Substack URL)
 *   --title <text>      Override the post title
 *   --date <text>       Override the date (default: the post's publish date)
 *   --authors <text>    Frontmatter authors (default: the Substack byline)
 *   --language <lang>   English | Norwegian (default: English)
 *   --hidden            Mark the post hidden (auth-gated)
 *   --profile <path>    Firefox profile directory to take cookies from
 *   --no-cookies        Fetch anonymously
 *   --force             Overwrite an existing post directory
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import TurndownService from 'turndown';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE_WIDTH = 650;
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0';

/* ------------------------------------------------------------------ args -- */

function parseArgs(argv) {
	const opts = { language: 'English', hidden: false, cookies: true, force: false };
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case '--slug':
			case '--title':
			case '--date':
			case '--authors':
			case '--language':
			case '--profile':
				opts[arg.slice(2)] = argv[++i];
				break;
			case '--hidden':
				opts.hidden = true;
				break;
			case '--no-cookies':
				opts.cookies = false;
				break;
			case '--force':
				opts.force = true;
				break;
			case '-h':
			case '--help':
				opts.help = true;
				break;
			default:
				if (arg.startsWith('-')) die(`Unknown option: ${arg}`);
				rest.push(arg);
		}
	}
	opts.url = rest[0];
	return opts;
}

function die(message) {
	console.error(`Error: ${message}`);
	process.exit(1);
}

/* --------------------------------------------------------------- cookies -- */

/** Locate the Firefox profile whose cookie jar we should read. */
function findFirefoxProfile(explicit) {
	if (explicit) return explicit;

	const base = path.join(os.homedir(), 'Library', 'Application Support', 'Firefox');
	const iniPath = path.join(base, 'profiles.ini');
	if (!fs.existsSync(iniPath)) return null;

	// profiles.ini lists both [ProfileN] entries and [InstallN] sections; the
	// install section's Default= points at the profile Firefox actually runs.
	const ini = fs.readFileSync(iniPath, 'utf8');
	const sections = ini.split(/^\[(.+)\]$/m).slice(1);
	const candidates = [];
	let installDefault = null;

	for (let i = 0; i < sections.length; i += 2) {
		const name = sections[i];
		const body = sections[i + 1] ?? '';
		const get = (key) => body.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();

		if (/^Install/.test(name)) {
			installDefault = get('Default') ?? installDefault;
		} else if (/^Profile/.test(name)) {
			const relative = get('Path');
			if (!relative) continue;
			const isRelative = get('IsRelative') !== '0';
			candidates.push(isRelative ? path.join(base, relative) : relative);
		}
	}

	if (installDefault) {
		const dir = path.isAbsolute(installDefault)
			? installDefault
			: path.join(base, installDefault);
		if (fs.existsSync(path.join(dir, 'cookies.sqlite'))) return dir;
	}

	// Otherwise fall back to whichever profile has the freshest cookie jar.
	const withCookies = candidates
		.map((dir) => ({ dir, jar: path.join(dir, 'cookies.sqlite') }))
		.filter(({ jar }) => fs.existsSync(jar))
		.sort((a, b) => fs.statSync(b.jar).mtimeMs - fs.statSync(a.jar).mtimeMs);

	return withCookies[0]?.dir ?? null;
}

/**
 * Read cookies for `host` out of a Firefox profile. Firefox stores cookie
 * values in the clear, so no keychain round-trip is needed — but the live jar
 * is locked while Firefox runs, so we query a copy.
 */
function readFirefoxCookies(profileDir, host) {
	const jar = path.join(profileDir, 'cookies.sqlite');
	if (!fs.existsSync(jar)) die(`No cookies.sqlite in ${profileDir}`);

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'substack-cookies-'));
	try {
		for (const suffix of ['', '-wal', '-shm']) {
			const src = jar + suffix;
			if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, 'cookies.sqlite' + suffix));
		}

		// A cookie applies to `host` if its domain matches exactly or is a
		// parent domain (Firefox stores those with a leading dot).
		const domains = new Set();
		const labels = host.split('.');
		for (let i = 0; i < labels.length - 1; i++) {
			const domain = labels.slice(i).join('.');
			domains.add(domain);
			domains.add('.' + domain);
		}
		const list = [...domains].map((d) => `'${d.replace(/'/g, "''")}'`).join(',');

		const out = execFileSync(
			'sqlite3',
			[
				'-json',
				path.join(tmp, 'cookies.sqlite'),
				`SELECT name, value FROM moz_cookies WHERE host IN (${list});`
			],
			{ encoding: 'utf8' }
		).trim();

		return out ? JSON.parse(out) : [];
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

function cookieHeader(cookies) {
	return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/* ----------------------------------------------------------------- fetch -- */

async function get(url, cookie, referer) {
	const headers = { 'User-Agent': USER_AGENT, Accept: '*/*' };
	if (cookie) headers.Cookie = cookie;
	// Some publication buckets and the CDN check the referrer on image requests.
	if (referer) headers.Referer = referer;

	const res = await fetch(url, { headers, redirect: 'follow' });
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
	return res;
}

/* --------------------------------------------------------------- extract -- */

/**
 * Substack ships the whole post as JSON in `window._preloads`, which is far
 * more reliable to read than the rendered markup.
 */
function extractPreloads(html) {
	const match = html.match(/window\._preloads\s*=\s*JSON\.parse\((".*?")\)\s*[;<]/s);
	if (!match) return null;
	try {
		return JSON.parse(JSON.parse(match[1]));
	} catch {
		return null;
	}
}

/** Fallback for pages without preloads: slice out the rendered article body. */
function extractRenderedBody(html) {
	const start = html.search(/<div[^>]*class="[^"]*\bavailable-content\b[^"]*"[^>]*>/);
	if (start === -1) return null;

	// Walk divs from the opening tag to find its matching close.
	const tag = /<div\b[^>]*>|<\/div>/g;
	tag.lastIndex = start;
	let depth = 0;
	let match;
	while ((match = tag.exec(html))) {
		depth += match[0] === '</div>' ? -1 : 1;
		if (depth === 0) return html.slice(start, match.index + match[0].length);
	}
	return null;
}

function metaContent(html, property) {
	const re = new RegExp(
		`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
		'i'
	);
	return html.match(re)?.[1];
}

function decodeEntities(text = '') {
	return text
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

function formatDate(iso) {
	if (!iso) return '';
	const date = new Date(iso);
	if (isNaN(date.getTime())) return '';
	return date.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/* ---------------------------------------------------------------- images -- */

const EXT_BY_TYPE = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/jpg': '.jpg',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'image/avif': '.avif',
	'image/svg+xml': '.svg'
};

const CDN_FORMAT = { '.png': 'f_png', '.jpg': 'f_jpg', '.jpeg': 'f_jpg', '.gif': 'f_gif' };

/**
 * Substack serves images through a resizing proxy whose path ends in the
 * URL-encoded original.
 */
function originalImageUrl(src) {
	const match = src.match(/\/image\/fetch\/[^/]*\/(https?%3A%2F%2F.+)$/i);
	if (match) {
		try {
			return decodeURIComponent(match[1]);
		} catch {
			/* fall through */
		}
	}
	return src;
}

function urlExtension(url) {
	try {
		return path.extname(new URL(url).pathname).toLowerCase();
	} catch {
		return '';
	}
}

/**
 * Where to try fetching an image from, best source first.
 *
 * The origin bucket gives us the untouched file, but some publications sit on
 * a private bucket that answers 403 — those are only reachable through the
 * CDN. The CDN defaults to re-encoding as JPEG, so when we know the original
 * format we ask for it explicitly rather than silently downgrading a PNG.
 */
function imageCandidates(origin, pageSrc) {
	const urls = [origin];

	const format = CDN_FORMAT[urlExtension(origin)];
	if (format) urls.push(`https://substackcdn.com/image/fetch/${format}/${encodeURIComponent(origin)}`);
	if (pageSrc !== origin) urls.push(pageSrc);

	return [...new Set(urls)];
}

/** Filename without an extension — the real one comes from the response. */
function imageBasename(url, index) {
	const pathname = (() => {
		try {
			return new URL(url).pathname;
		} catch {
			return url;
		}
	})();

	const base = decodeURIComponent(path.basename(pathname, path.extname(pathname)))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40);

	// Substack filenames are often opaque hashes; prefix with the figure number
	// so the directory reads in document order.
	return `${String(index).padStart(2, '0')}-${base || 'image'}`;
}

/* -------------------------------------------------------------- markdown -- */

function attr(value) {
	return String(value ?? '').replace(/"/g, '&quot;');
}

/**
 * Substack renders multi-image galleries as an empty <div> whose images live in
 * an HTML-escaped JSON `data-attrs` blob. Turndown skips empty elements
 * entirely, so rewrite them into real <figure> markup before conversion.
 */
function expandGalleries(html) {
	return html.replace(
		/<div\b([^>]*\bimage-gallery-embed\b[^>]*)>\s*<\/div>/g,
		(whole, attrs) => {
			const raw = attrs.match(/data-attrs="([^"]*)"/)?.[1];
			if (!raw) return whole;

			let gallery;
			try {
				gallery = JSON.parse(decodeEntities(raw)).gallery;
			} catch {
				return whole;
			}

			const images = (gallery?.images ?? []).filter((img) => img?.src);
			if (!images.length) return whole;

			const alt = attr(gallery.alt || '');
			const caption = String(gallery.caption ?? '').trim();

			return [
				'<figure>',
				...images.map((img) => `<img src="${attr(img.src)}" alt="${alt}">`),
				caption && `<figcaption>${caption}</figcaption>`,
				'</figure>'
			]
				.filter(Boolean)
				.join('');
		}
	);
}

function createTurndown(collectImage) {
	const service = new TurndownService({
		headingStyle: 'atx',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced',
		emDelimiter: '_',
		linkStyle: 'inlined'
	});

	service.remove(['script', 'style', 'noscript']);

	// Subscription widgets, share buttons, paywall prompts and the like.
	service.addRule('substackChrome', {
		filter: (node) => {
			const cls = node.getAttribute?.('class') ?? '';
			return /\b(subscription-widget|subscribe-widget|button-wrapper|share-dialog|paywall|pencraft|footer|poll-embed|native-video-embed)\b/.test(
				cls
			);
		},
		replacement: () => ''
	});

	// Images become the same <figure> block the hand-written posts use.
	service.addRule('figure', {
		filter: (node) =>
			node.nodeName === 'FIGURE' ||
			/\bcaptioned-image-container\b/.test(node.getAttribute?.('class') ?? ''),
		replacement: (_content, node) => {
			// Array.from, not spread: the DOM shim's NodeList is array-like but
			// not iterable.
			const images = Array.from(node.querySelectorAll('img'))
				.map((img) => ({
					src: img.getAttribute('src') || img.getAttribute('data-src') || '',
					alt: attr(img.getAttribute('alt'))
				}))
				.filter((img) => img.src);
			if (!images.length) return '';

			// Keep the caption as HTML so its links survive — mdsvex does not
			// process markdown inside a raw HTML block.
			const captionEl = node.querySelector('figcaption');
			const caption = captionEl ? captionEl.innerHTML.trim() : '';

			const lines = [
				'<figure>',
				...images.map(
					(img) =>
						`<img src="${collectImage(img.src)}" width="${IMAGE_WIDTH}" alt="${img.alt}">`
				),
				caption && `<figcaption> <i> ${caption} </i> </figcaption>`,
				'</figure>'
			].filter(Boolean);

			return `\n\n${lines.join('\n')}\n\n`;
		}
	});

	// A bare <img> (not wrapped in a figure) still needs its src localised.
	service.addRule('image', {
		filter: 'img',
		replacement: (_content, node) => {
			const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
			if (!src) return '';
			const alt = (node.getAttribute('alt') || '').replace(/"/g, '&quot;');
			return `\n\n<img src="${collectImage(src)}" width="${IMAGE_WIDTH}" alt="${alt}">\n\n`;
		}
	});

	// Substack footnotes render as anchors with a lot of wrapper markup.
	service.addRule('footnoteAnchor', {
		filter: (node) =>
			node.nodeName === 'A' && /\bfootnote-anchor\b/.test(node.getAttribute('class') ?? ''),
		replacement: (content) => `[^${content.trim()}]`
	});

	service.addRule('footnote', {
		filter: (node) => /\bfootnote\b/.test(node.getAttribute?.('class') ?? ''),
		replacement: (content, node) => {
			const number = node.querySelector('.footnote-number')?.textContent.trim() ?? '';
			const text = node.querySelector('.footnote-content')?.textContent.trim() ?? content.trim();
			return `\n\n[^${number}]: ${text}\n\n`;
		}
	});

	return service;
}

/* ------------------------------------------------------------------ main -- */

const HELP = `Usage: node scripts/import-substack.js <substack-url> [options]

  --slug <name>      output slug (default: slug from the URL)
  --title <text>     override the title
  --date <text>      override the date
  --authors <text>   frontmatter authors (default: Substack byline)
  --language <lang>  English | Norwegian (default: English)
  --hidden           gate the post behind auth
  --profile <path>   Firefox profile directory to read cookies from
  --no-cookies       fetch anonymously
  --force            overwrite an existing post directory
`;

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (opts.help || !opts.url) {
		console.log(HELP);
		process.exit(opts.help ? 0 : 1);
	}

	let url;
	try {
		url = new URL(opts.url);
	} catch {
		die(`Not a valid URL: ${opts.url}`);
	}

	// --- cookies ---
	let cookie = '';
	if (opts.cookies) {
		const profile = findFirefoxProfile(opts.profile);
		if (!profile) {
			console.warn('! No Firefox profile found — continuing without cookies.');
		} else {
			const cookies = readFirefoxCookies(profile, url.hostname);
			cookie = cookieHeader(cookies);
			console.log(
				`→ ${cookies.length} cookie(s) for ${url.hostname} from ${path.basename(profile)}`
			);
			if (!cookies.length) {
				console.warn('! No cookies matched — a paywalled post may come down truncated.');
			}
		}
	}

	// --- page ---
	console.log(`→ Fetching ${url.href}`);
	const html = await (await get(url.href, cookie)).text();

	const preloads = extractPreloads(html);
	const post = preloads?.post ?? preloads?.pub?.post ?? null;

	let bodyHtml = post?.body_html;
	if (!bodyHtml) {
		bodyHtml = extractRenderedBody(html);
		if (bodyHtml) console.warn('! Using rendered markup (no _preloads on the page).');
	}
	if (!bodyHtml) die('Could not find the post body in the page.');

	if (post && post.audience && post.audience !== 'everyone' && !post.should_show_full_post) {
		console.warn(`! Post audience is "${post.audience}" and may be truncated — check the output.`);
	}

	const title =
		opts.title ?? decodeEntities(post?.title ?? metaContent(html, 'og:title') ?? '') ?? '';
	const description = decodeEntities(
		post?.subtitle ?? metaContent(html, 'og:description') ?? metaContent(html, 'description') ?? ''
	);
	const date =
		opts.date ??
		formatDate(post?.post_date ?? metaContent(html, 'article:published_time')) ??
		'';
	const authors =
		opts.authors ??
		post?.publishedBylines?.map((b) => b.name).filter(Boolean).join(', ') ??
		decodeEntities(metaContent(html, 'author') ?? '') ??
		'';

	const slug =
		opts.slug ??
		post?.slug ??
		url.pathname.split('/').filter(Boolean).pop() ??
		'substack-post';

	// --- destinations ---
	const postDir = path.join(ROOT, 'src', 'routes', 'blog', slug);
	const imageDir = path.join(ROOT, 'static', slug);
	const postFile = path.join(postDir, '+page.md');

	if (fs.existsSync(postFile) && !opts.force) {
		die(`${path.relative(ROOT, postFile)} already exists (use --force to overwrite).`);
	}

	// --- convert ---
	// The real extension isn't known until the image is fetched, so the
	// markdown gets a placeholder that is swapped for the filename afterwards.
	const downloads = new Map(); // origin url -> {token, basename, candidates}

	const turndown = createTurndown((src) => {
		const origin = originalImageUrl(src);
		if (!downloads.has(origin)) {
			const index = downloads.size + 1;
			downloads.set(origin, {
				token: `@@SUBSTACK_IMAGE_${index}@@`,
				basename: imageBasename(origin, index),
				candidates: imageCandidates(origin, src)
			});
		}
		return `/${slug}/${downloads.get(origin).token}`;
	});

	let markdown = turndown
		.turndown(expandGalleries(bodyHtml))
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	// --- images ---
	if (downloads.size) {
		fs.mkdirSync(imageDir, { recursive: true });
		console.log(`→ Downloading ${downloads.size} image(s) into static/${slug}/`);

		const taken = new Set();
		const failed = [];

		for (const [origin, image] of downloads) {
			let saved = null;
			let lastError = 'no candidate URLs';

			for (const candidate of image.candidates) {
				try {
					const res = await get(candidate, cookie, url.origin);
					const buffer = Buffer.from(await res.arrayBuffer());
					const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();

					let ext = EXT_BY_TYPE[type];
					if (!ext) {
						const fromUrl = urlExtension(origin);
						ext = /^\.(png|jpe?g|gif|webp|avif|svg)$/.test(fromUrl) ? fromUrl : '.png';
					}

					let name = image.basename + ext;
					let n = 2;
					while (taken.has(name)) name = `${image.basename}-${n++}${ext}`;
					taken.add(name);

					fs.writeFileSync(path.join(imageDir, name), buffer);
					saved = name;
					console.log(`  ${name}  (${(buffer.length / 1024).toFixed(0)} kB)`);
					break;
				} catch (err) {
					lastError = err.message;
				}
			}

			if (saved) {
				markdown = markdown.replaceAll(image.token, saved);
			} else {
				// Leave a sensible filename in place so the image can be dropped
				// in by hand rather than leaving a placeholder in the markdown.
				const fallback = image.basename + (urlExtension(origin) || '.png');
				markdown = markdown.replaceAll(image.token, fallback);
				failed.push({ name: fallback, origin, error: lastError });
				console.warn(`  ! ${fallback}: ${lastError}`);
			}
		}

		if (failed.length) {
			console.warn(`\n! ${failed.length} of ${downloads.size} image(s) could not be downloaded.`);
			console.warn('  Their <img> tags still point at static/' + slug + '/ — save them manually:');
			for (const { name, origin } of failed) console.warn(`    ${name}  <-  ${origin}`);
		}
	}

	// --- write ---
	const frontmatter = [
		'---',
		`title: ${yaml(title)}`,
		`description: ${yaml(description)}`,
		`date: ${yaml(date)}`,
		`authors: ${yaml(authors)}`,
		`language: ${opts.language}`,
		`hidden: ${opts.hidden}`,
		'---',
		''
	].join('\n');

	fs.mkdirSync(postDir, { recursive: true });
	fs.writeFileSync(postFile, `${frontmatter}\n${markdown}\n`);

	console.log(`\n✓ ${path.relative(ROOT, postFile)}`);
	console.log(`  source: ${url.href}`);
	console.log(`  visit:  /blog/${slug}`);
}

/** Quote a frontmatter scalar only when YAML would otherwise misread it. */
function yaml(value) {
	const text = String(value ?? '').replace(/\s+/g, ' ').trim();
	if (!text) return "''";
	if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(text) || /: |#|\n/.test(text)) {
		return `'${text.replace(/'/g, "''")}'`;
	}
	return text;
}

main().catch((err) => die(err.message));
