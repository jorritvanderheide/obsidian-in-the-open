import { createServer, type IncomingHttpHeaders } from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { send } from '../src/http';

// A real server on this computer, which `secure` lets plain http reach: what
// arrives there is what a site gets.
let base = '';
let received: { headers: IncomingHttpHeaders; body: string } | null = null;
const server = createServer((req, res) => {
	const chunks: Buffer[] = [];
	req.on('data', (chunk: Buffer) => chunks.push(chunk));
	req.on('end', () => {
		received = { headers: req.headers, body: Buffer.concat(chunks).toString('utf8') };
		res.writeHead(201, { Location: '/log/x/' }).end();
	});
});
beforeAll(() => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => {
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	resolve();
})));
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('send', () => {
	it('sends a body with its length, not in chunks', async () => {
		const body = '{"name": ["Ännë"]}';
		const response = await send(`${base}/micropub`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
		expect(response.status).toBe(201);
		expect(response.headers.location).toBe('/log/x/');
		expect(received?.body).toBe(body);
		expect(received?.headers['content-length']).toBe(String(Buffer.byteLength(body)));
		expect(received?.headers['transfer-encoding']).toBeUndefined();
	});

	it('sends bytes with their length too', async () => {
		const bytes = new Uint8Array([0, 1, 2, 3, 255]);
		await send(`${base}/media`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: bytes });
		expect(received?.headers['content-length']).toBe('5');
	});
});
