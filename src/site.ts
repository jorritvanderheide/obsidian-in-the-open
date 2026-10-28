// A site, as In the Open talks to it: its endpoint, found from its home page,
// what it takes, and the requests that carry the token.
import { randomBytes } from 'crypto';
import { ConflictError, endpointFrom, failure, PublishError, readCategories, RefusedError, readConfig, readSource, secure, type Config, type Response, type Source } from './core/micropub';
import { page, send } from './http';

export interface Site {
	/** The site's own address. */
	home: string;
	endpoint: string;
	token: string;
	config: Config;
}

/** Find the site's endpoint, and ask what it takes. */
export async function connect(home: string, token: string): Promise<Site> {
	const { url, response } = await page(`${home}/`);
	if (response.status >= 400) throw new PublishError(`${home} didn't load, so In the Open can't find out where to send posts (error ${response.status}). Check that Site in Settings → In the Open is your site's home page, and that it opens in a browser.`);
	const endpoint = endpointFrom(url, response);
	if (endpoint === null) {
		throw new PublishError(`${home} doesn't say where to send posts. A site that takes Micropub says so on its home page, with a Link header or a <link rel="micropub"> tag. Check that Site in Settings → In the Open is your site's home page.`);
	}
	if (!secure(endpoint)) throw new PublishError(`${home} takes posts at ${endpoint}, which isn't https, so In the Open won't send your token there.`);
	const site = { home, endpoint, token, config: { mediaEndpoint: null, references: null, drafts: false } as Config };
	const answer = await call(site, query(site, 'q=config'), { method: 'GET' });
	site.config = readConfig(answer.body);
	if (site.config.mediaEndpoint !== null && !secure(site.config.mediaEndpoint)) site.config.mediaEndpoint = null;
	return site;
}

/** A request with the token. A redirect is an error, never followed: the token stays with this site. */
export async function call(site: Site, url: string, request: { method: string; type?: string; body?: string | Uint8Array }): Promise<Response> {
	const headers: Record<string, string> = { Authorization: `Bearer ${site.token}`, Accept: 'application/json' };
	if (request.type !== undefined) headers['Content-Type'] = request.type;
	const response = await send(url, { method: request.method, headers, body: request.body });
	if (response.status >= 300 && response.status < 400) {
		throw new RefusedError(`${new URL(url).host} answered with a redirect, which In the Open doesn't follow with your token. Check the site's address in the settings.`);
	}
	if (response.status === 401) throw new RefusedError(`${new URL(url).host} doesn't take your token. Check the token in Settings → In the Open.`);
	// The post was changed on the site since it was last sent (docs/micropub.md,
	// Changed elsewhere): publishing asks before sending it again with
	// mp-overwrite.
	if (response.status === 409) throw new ConflictError(failure(response));
	// A server's own error (`5xx`) may come after it made the post, so it isn't
	// taken as a refusal.
	if (response.status >= 400) {
		const message = `${new URL(url).host} turned the request down. It answered: ${failure(response)}`;
		throw response.status < 500 ? new RefusedError(message) : new PublishError(message);
	}
	return response;
}

/** The endpoint, asked something. */
function query(site: Site, what: string): string {
	return `${site.endpoint}${site.endpoint.includes('?') ? '&' : '?'}${what}`;
}

/** Whether the post at `url` is a draft. Only a site that takes drafts is asked: on any other, it's published. */
export async function isDraft(site: Site, url: string): Promise<boolean> {
	if (!site.config.drafts) return false;
	const answer = await call(site, query(site, `q=source&properties[]=post-status&url=${encodeURIComponent(url)}`), { method: 'GET' });
	return readSource(answer.body).draft;
}

/**
 * The post at `url` as the site has it, for comparing with the note before an
 * update, or null when the site doesn't answer: a site that takes no drafts
 * needn't know `q=source`, and is then updated without comparing. One that
 * takes drafts has to answer it, so its failure is said.
 */
export async function sourceOf(site: Site, url: string): Promise<Source | null> {
	try {
		const answer = await call(site, query(site, `q=source&url=${encodeURIComponent(url)}`), { method: 'GET' });
		return readSource(answer.body);
	} catch (error) {
		if (site.config.drafts) throw error;
		return null;
	}
}

/**
 * The site's categories, or null when it doesn't list them. Then there's
 * nothing to check a post's against, and the site says itself what it refuses.
 */
export async function categoriesOf(site: Site): Promise<string[] | null> {
	try {
		const answer = await call(site, query(site, 'q=category'), { method: 'GET' });
		return readCategories(answer.body);
	} catch {
		return null;
	}
}

/** Send JSON to the endpoint. */
export function post(site: Site, body: string): Promise<Response> {
	return call(site, site.endpoint, { method: 'POST', type: 'application/json', body });
}

/** Upload one image to the media endpoint, and return its address. */
export async function upload(site: Site, media: string, body: (boundary: string) => Uint8Array): Promise<string> {
	const boundary = `----in-the-open-${randomBytes(12).toString('hex')}`;
	const response = await call(site, media, { method: 'POST', type: `multipart/form-data; boundary=${boundary}`, body: body(boundary) });
	const location = response.headers.location;
	if (location === undefined) throw new PublishError(`${new URL(media).host}'s media endpoint took the image but didn't say where it is.`);
	return new URL(location, media).href;
}
