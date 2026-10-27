// A site, as In the Open talks to it: its endpoint, found from its home page,
// what it takes, and the requests that carry the token.
import { randomBytes } from 'crypto';
import { endpointFrom, failure, PublishError, readConfig, secure, type Config, type Response } from './core/micropub';
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
	if (response.status >= 400) throw new PublishError(`${home} answered ${response.status}, so its Micropub endpoint can't be found there.`);
	const endpoint = endpointFrom(url, response);
	if (endpoint === null) {
		throw new PublishError(`${home} doesn't say where its Micropub endpoint is: In the Open looks for a Link header or a <link> with rel="micropub" on its home page.`);
	}
	if (!secure(endpoint)) throw new PublishError(`${home}'s Micropub endpoint, ${endpoint}, isn't https, so In the Open doesn't send it your token.`);
	const site = { home, endpoint, token, config: { mediaEndpoint: null, references: null } as Config };
	const answer = await call(site, `${endpoint}${endpoint.includes('?') ? '&' : '?'}q=config`, { method: 'GET' });
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
		throw new PublishError(`${new URL(url).host} answered with a redirect, which In the Open doesn't follow with your token. Check the site's address in the settings.`);
	}
	if (response.status === 401) throw new PublishError(`${new URL(url).host} doesn't take your token. Check the token in Settings → In the Open.`);
	if (response.status >= 400) throw new PublishError(`${new URL(url).host} refused it: ${failure(response)}`);
	return response;
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
