// Micropub, as In the Open speaks it (docs/micropub.md): finding a site's
// endpoint, what it says it takes, and the requests and their answers. Pure:
// what goes over the wire is the transport's (src/http.ts).

/** A failure already written as a sentence for the person reading it. */
export class PublishError extends Error {}

/** A site's `409`: the post was changed there since it was last sent. The message is the site's own words. */
export class ConflictError extends PublishError {}

/** An answer, with its headers' names in lower case. */
export interface Response {
	status: number;
	headers: Record<string, string>;
	body: string;
}

/** Whether `url` may carry the token: https, or http to this machine, for a site in development. */
export function secure(url: string): boolean {
	try {
		const { protocol, hostname } = new URL(url);
		return protocol === 'https:' || (protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(hostname));
	} catch {
		return false;
	}
}

/**
 * The site's Micropub endpoint, from its home page: a `Link` header with
 * `rel="micropub"`, or else a `<link rel="micropub">` in the page, as
 * Micropub says. Resolved against the page's address. Null when there is
 * neither.
 */
export function endpointFrom(page: string, response: Response): string | null {
	const header = response.headers.link ?? '';
	for (const part of header.split(/,(?=\s*<)/)) {
		const match = /^\s*<([^>]*)>(.*)$/.exec(part);
		const rel = /;\s*rel\s*=\s*"?([^";]*)"?/i.exec(match?.[2] ?? '')?.[1] ?? '';
		if (match && rel.split(/\s+/).includes('micropub')) return new URL(match[1] ?? '', page).href;
	}
	for (const tag of response.body.match(/<link\b[^>]*>/gi) ?? []) {
		const rel = /\brel\s*=\s*["']?([^"'>]*)["']?/i.exec(tag)?.[1] ?? '';
		const href = /\bhref\s*=\s*["']?([^"'\s>]*)["']?/i.exec(tag)?.[1];
		if (href !== undefined && rel.split(/\s+/).includes('micropub')) return new URL(href.replace(/&amp;/g, '&'), page).href;
	}
	return null;
}

/** What a site says it takes, from `q=config`. */
export interface Config {
	/** Where images go, or null for a site that takes none. */
	mediaEndpoint: string | null;
	/** The version of the references extension it takes, or null for none. */
	references: number | null;
	/** Whether it takes drafts: `draft` in its `post-status`. A site that doesn't would publish one at once. */
	drafts: boolean;
}

export function readConfig(body: string): Config {
	let config: Record<string, unknown> = {};
	try {
		const parsed: unknown = JSON.parse(body);
		if (parsed !== null && typeof parsed === 'object') config = parsed as Record<string, unknown>;
	} catch {
		throw new PublishError("The site's Micropub endpoint didn't answer q=config with JSON.");
	}
	const media = config['media-endpoint'];
	const references = config.references;
	const statuses = config['post-status'];
	return {
		mediaEndpoint: typeof media === 'string' && media !== '' ? media : null,
		references: typeof references === 'number' && references >= 1 ? references : null,
		drafts: Array.isArray(statuses) && statuses.includes('draft'),
	};
}

/**
 * A post as the site has it, from `q=source`: only what it gave. A post
 * that says nothing of its status is a published one.
 */
export interface Source {
	draft: boolean;
	title?: string;
	summary?: string;
	/** Markdown or HTML, as the site keeps it. */
	content?: string;
	categories?: string[];
	references?: Reference[];
}

export function readSource(body: string): Source {
	let props: Record<string, unknown> = {};
	try {
		const parsed = JSON.parse(body) as { properties?: unknown };
		if (parsed.properties !== null && typeof parsed.properties === 'object') props = parsed.properties as Record<string, unknown>;
	} catch {
		throw new PublishError("The site's Micropub endpoint didn't answer q=source with JSON.");
	}
	const list = (name: string): unknown[] | undefined => (Array.isArray(props[name]) ? (props[name] as unknown[]) : undefined);
	const text = (name: string): string | undefined => {
		const value = list(name)?.[0];
		if (typeof value === 'string') return value;
		// Micropub gives content with markup as an object: its HTML, or its text.
		if (value !== null && typeof value === 'object') {
			const { html, value: plain } = value as { html?: unknown; value?: unknown };
			if (typeof html === 'string') return html;
			if (typeof plain === 'string') return plain;
		}
		return undefined;
	};
	const source: Source = { draft: list('post-status')?.[0] === 'draft' };
	const title = text('name');
	if (title !== undefined) source.title = title;
	const summary = text('summary');
	if (summary !== undefined) source.summary = summary;
	const content = text('content');
	if (content !== undefined) source.content = content;
	const categories = list('category');
	if (categories !== undefined) source.categories = categories.filter((each): each is string => typeof each === 'string');
	const references = list('references');
	if (references !== undefined) {
		source.references = references.flatMap((each) => {
			const { key, text, url } = (each ?? {}) as Record<string, unknown>;
			return typeof key === 'string' && typeof text === 'string' ? [{ key, text, url: typeof url === 'string' && url !== '' ? url : null }] : [];
		});
	}
	return source;
}

/**
 * The text, for comparing: line endings, space at the ends of lines and of
 * the text aside, and each image by its alt text only, since a site may keep
 * an image at an address of its own.
 */
function comparable(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/!\[((?:[^\]\\]|\\.)*)\]\((?:<[^>]*>|[^)\s]*)(?:\s+"[^"]*")?\)/g, '![$1]()')
		.replace(/(<img\b[^>]*?)\s+src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')
		.replace(/[ \t]+$/gm, '')
		.trim();
}

/**
 * What an update would change in the post as the site has it, in words: "the
 * title", "the text" and so on. Only what the site gave is compared, and
 * images by their alt text, so an empty list can still hide a new picture.
 */
export function differences(post: Post, online: Source): string[] {
	const changed: string[] = [];
	if (online.title !== undefined && online.title.trim() !== post.title.trim()) changed.push('the title');
	if (online.summary !== undefined && online.summary.trim() !== (post.summary ?? '').trim()) changed.push('the summary');
	const content = 'markdown' in post.content ? post.content.markdown : post.content.html;
	if (online.content !== undefined && comparable(online.content) !== comparable(content)) changed.push('the text');
	if (online.categories !== undefined && [...online.categories].sort().join('\n') !== [...post.categories].sort().join('\n')) changed.push('the categories');
	if (online.references !== undefined && post.references !== null) {
		const same = (a: Reference[]) => JSON.stringify(a.map(({ key, text, url }) => [key, text.trim(), url ?? '']));
		if (same(online.references) !== same(post.references)) changed.push('the references');
	}
	return changed;
}

/** The site's categories, from `q=category`, or null when it gives none to check against. */
export function readCategories(body: string): string[] | null {
	try {
		const parsed = JSON.parse(body) as { categories?: unknown };
		return Array.isArray(parsed.categories) ? parsed.categories.filter((each): each is string => typeof each === 'string') : null;
	} catch {
		return null;
	}
}

/** The categories the site doesn't have, each once, in the note's order. */
export function unknownCategories(wanted: string[], known: string[]): string[] {
	return [...new Set(wanted.filter((category) => !known.includes(category)))];
}

/** Things in a sentence: "a", "a and b", "a, b and c". */
export function listed(things: string[]): string {
	return things.length <= 1 ? (things[0] ?? '') : `${things.slice(0, -1).join(', ')} and ${things.at(-1) ?? ''}`;
}

/** A work a post cites, as the references extension sends it. */
export interface Reference {
	key: string;
	text: string;
	url: string | null;
}

/** A post: what a note becomes. */
export interface Post {
	title: string;
	summary: string | null;
	/** Markdown, for a site that takes the references extension, or HTML for any other. */
	content: { markdown: string } | { html: string };
	categories: string[];
	slug: string | null;
	/** The works it cites, for a site that takes the extension. */
	references: Reference[] | null;
	/** Its `post-status`: a draft, a draft being published, or null to send none, as for any other post. */
	status: 'draft' | 'published' | null;
}

/** Micropub's properties of a post: each a list. */
function properties(post: Post): Record<string, unknown[]> {
	const props: Record<string, unknown[]> = {
		name: [post.title],
		content: ['markdown' in post.content ? post.content.markdown : { html: post.content.html }],
		category: post.categories,
	};
	if (post.status !== null) props['post-status'] = [post.status];
	if (post.summary !== null) props.summary = [post.summary];
	if (post.references !== null) props.references = post.references.map(({ key, text, url }) => (url === null ? { key, text } : { key, text, url }));
	return props;
}

/** A new post, as a create request. */
export function createBody(post: Post): string {
	const props = properties(post);
	if (post.slug !== null) props['mp-slug'] = [post.slug];
	return JSON.stringify({ type: ['h-entry'], properties: props });
}

/**
 * A post sent again, as an update that replaces everything In the Open sends.
 * `updated` only when the change is one of substance: a correction leaves it
 * out. `overwrite` when the site refused it for a change made there, and
 * you said to replace that change.
 */
export function updateBody(url: string, post: Post, updated: Date | null, overwrite = false): string {
	const replace = properties(post);
	if (updated !== null) replace.updated = [updated.toISOString().replace(/\.\d{3}Z$/, 'Z')];
	return JSON.stringify(overwrite ? { action: 'update', url, 'mp-overwrite': true, replace } : { action: 'update', url, replace });
}

/** Withdrawing a post (delete), with why when it's said, or bringing it back (undelete). */
export function actionBody(action: 'delete' | 'undelete', url: string, reason = ''): string {
	const why = reason.trim();
	return JSON.stringify(action === 'delete' && why !== '' ? { action, url, reason: why } : { action, url });
}

/** What went wrong, from an answer that isn't a success: the site's own words when it gives them. */
export function failure(response: Response): string {
	try {
		const parsed = JSON.parse(response.body) as Record<string, unknown>;
		const description = parsed.error_description;
		const code = parsed.error;
		if (typeof description === 'string' && description !== '') return description;
		if (typeof code === 'string' && code !== '') return `${code} (${response.status})`;
	} catch {
		// Not Micropub's JSON: the status says it.
	}
	return `the site answered ${response.status}`;
}

/** An image for the media endpoint, as multipart/form-data with the file in a field called `file`. */
export function multipart(name: string, type: string, data: Uint8Array, boundary: string): Uint8Array {
	const encoder = new TextEncoder();
	const head = encoder.encode(
		`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name.replace(/["\r\n]/g, '_')}"\r\nContent-Type: ${type}\r\n\r\n`,
	);
	const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
	const body = new Uint8Array(head.length + data.length + tail.length);
	body.set(head, 0);
	body.set(data, head.length);
	body.set(tail, head.length + data.length);
	return body;
}

/** The type an image is sent as, by its extension, or null for one a site isn't sent. */
export function imageType(path: string): string | null {
	const ext = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase();
	return ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : null;
}

/** An image in the note as the core writes it, `![alt](<path>)`, on disk. */
export interface Image {
	alt: string;
	path: string;
}

const IMAGE = /!\[((?:[^\]\\]|\\.)*)\]\(<([^>]+)>\)/g;

/** The images in the note, each once, as the core resolved them to files. */
export function images(markdown: string): Image[] {
	const found: Image[] = [];
	for (const match of markdown.matchAll(IMAGE)) {
		const image = { alt: (match[1] ?? '').trim(), path: match[2] ?? '' };
		if (!found.some((each) => each.path === image.path && each.alt === image.alt)) found.push(image);
	}
	return found;
}

/** The note with each image's file swapped for the address the media endpoint gave it. */
export function withAddresses(markdown: string, addresses: Map<string, string>): string {
	return markdown.replace(IMAGE, (image: string, alt: string, path: string) => {
		const address = addresses.get(path);
		return address === undefined ? image : `![${alt}](<${address}>)`;
	});
}
