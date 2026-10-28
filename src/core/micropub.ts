// Micropub, as In the Open speaks it (docs/micropub.md): finding a site's
// endpoint, what it says it takes, and the requests and their answers. Pure:
// what goes over the wire is the transport's (src/http.ts).

/** A failure already written as a sentence for the person reading it. */
export class PublishError extends Error {}

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

/** Whether a post is a draft, from `q=source`. Anything else is a published post. */
export function readDraft(body: string): boolean {
	try {
		const parsed = JSON.parse(body) as { properties?: Record<string, unknown> };
		const status = parsed.properties?.['post-status'];
		return Array.isArray(status) && status[0] === 'draft';
	} catch {
		throw new PublishError("The site's Micropub endpoint didn't answer q=source with JSON.");
	}
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
 * out.
 */
export function updateBody(url: string, post: Post, updated: Date | null): string {
	const replace = properties(post);
	if (updated !== null) replace.updated = [updated.toISOString().replace(/\.\d{3}Z$/, 'Z')];
	return JSON.stringify({ action: 'update', url, replace });
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
