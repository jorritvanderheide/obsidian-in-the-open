// What goes over the wire: Node's https, not Obsidian's requestUrl, which
// follows redirects with no way to stop it, and so could take the token to
// another site. A request with the token never follows one.
import { request as httpRequest, type IncomingHttpHeaders } from 'http';
import { request as httpsRequest } from 'https';
import { PublishError, secure, type Response } from './core/micropub';

const TIMEOUT = 30_000;

export interface Request {
	method?: string;
	headers?: Record<string, string>;
	body?: string | Uint8Array;
}

/** One request, and its answer, redirects and all, as they come. */
export function send(url: string, request: Request = {}): Promise<Response> {
	if (!secure(url)) return Promise.reject(new PublishError(`${url} isn't https, so In the Open doesn't send anything there.`));
	const { protocol } = new URL(url);
	const open = protocol === 'https:' ? httpsRequest : httpRequest;
	return new Promise((resolve, reject) => {
		const req = open(url, { method: request.method ?? 'GET', headers: request.headers, timeout: TIMEOUT }, (res) => {
			const chunks: Buffer[] = [];
			res.on('data', (chunk: Buffer) => chunks.push(chunk));
			res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: lowerCase(res.headers), body: Buffer.concat(chunks).toString('utf8') }));
			res.on('error', reject);
		});
		req.on('timeout', () => req.destroy(new PublishError(`${new URL(url).host} didn't answer within ${TIMEOUT / 1000} seconds.`)));
		req.on('error', (error: NodeJS.ErrnoException) =>
			reject(error instanceof PublishError ? error : new PublishError(`Couldn't reach ${new URL(url).host}: ${error.message}`)),
		);
		if (request.body !== undefined) req.write(request.body);
		req.end();
	});
}

/**
 * A page anyone may read, such as the site's home page, following a few
 * redirects, as a browser would: no token goes with it. Resolves to the
 * answer and the address it came from.
 */
export async function page(url: string): Promise<{ url: string; response: Response }> {
	let at = url;
	for (let hops = 0; hops < 5; hops++) {
		const response = await send(at);
		const location = response.headers.location;
		if (response.status < 300 || response.status >= 400 || location === undefined) return { url: at, response };
		at = new URL(location, at).href;
	}
	throw new PublishError(`${url} redirects too many times.`);
}

function lowerCase(headers: IncomingHttpHeaders): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [name, value] of Object.entries(headers)) {
		if (value !== undefined) out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
	}
	return out;
}
