import { describe, expect, it } from 'vitest';
import { actionBody, createBody, endpointFrom, failure, imageType, images, multipart, readConfig, secure, updateBody, withAddresses, type Post, type Response } from '../src/core/micropub';

const answer = (body: string, headers: Record<string, string> = {}, status = 200): Response => ({ status, headers, body });

describe('endpointFrom', () => {
	it('reads the Link header first, resolved against the page', () => {
		expect(endpointFrom('https://bw20.nl/', answer('', { link: '</micropub>; rel="micropub"' }))).toBe('https://bw20.nl/micropub');
		expect(endpointFrom('https://bw20.nl/', answer('', { link: '<https://a.example/x>; rel="me", <https://mp.example/m>; rel="authorization_endpoint micropub"' }))).toBe('https://mp.example/m');
	});

	it('reads a link in the page, in either order of its attributes', () => {
		expect(endpointFrom('https://bw20.nl/', answer('<head><link href="/mp?a=1&amp;b=2" rel="micropub"></head>'))).toBe('https://bw20.nl/mp?a=1&b=2');
		expect(endpointFrom('https://bw20.nl/blog/', answer("<link rel='micropub' href='endpoint'>"))).toBe('https://bw20.nl/blog/endpoint');
	});

	it('finds none on a site without one', () => {
		expect(endpointFrom('https://bw20.nl/', answer('<link rel="stylesheet" href="/s.css">', { link: '</x>; rel="me"' }))).toBeNull();
	});
});

describe('secure', () => {
	it('lets the token go over https, or http to this machine only', () => {
		expect(secure('https://bw20.nl/micropub')).toBe(true);
		expect(secure('http://localhost:8081/micropub')).toBe(true);
		expect(secure('http://bw20.nl/micropub')).toBe(false);
		expect(secure('not a url')).toBe(false);
	});
});

describe('readConfig', () => {
	it('reads the media endpoint and the references extension', () => {
		expect(readConfig('{"media-endpoint": "https://bw20.nl/micropub/media", "references": 1}')).toEqual({ mediaEndpoint: 'https://bw20.nl/micropub/media', references: 1 });
		expect(readConfig('{}')).toEqual({ mediaEndpoint: null, references: null });
		expect(() => readConfig('<html>')).toThrow("didn't answer q=config with JSON");
	});
});

const post: Post = {
	title: 'Quiet',
	summary: 'Why.',
	content: { markdown: 'As [A 2024](#ref-a).' },
	categories: ['tech'],
	slug: 'quiet',
	references: [
		{ key: 'a', text: 'A, Ann. 2024. *First*.', url: 'https://doi.org/10.1/x' },
		{ key: 'b', text: 'B.', url: null },
	],
};

describe('the requests', () => {
	it('creates a post as Micropub JSON, each property a list', () => {
		expect(JSON.parse(createBody(post))).toEqual({
			type: ['h-entry'],
			properties: {
				name: ['Quiet'],
				summary: ['Why.'],
				content: ['As [A 2024](#ref-a).'],
				category: ['tech'],
				'mp-slug': ['quiet'],
				references: [{ key: 'a', text: 'A, Ann. 2024. *First*.', url: 'https://doi.org/10.1/x' }, { key: 'b', text: 'B.' }],
			},
		});
	});

	it('sends HTML as an object, and no references to a site without the extension', () => {
		const props = (JSON.parse(createBody({ ...post, content: { html: '<p>x</p>' }, references: null, slug: null, summary: null })) as { properties: Record<string, unknown> }).properties;
		expect(props).toEqual({ name: ['Quiet'], content: [{ html: '<p>x</p>' }], category: ['tech'] });
	});

	it('updates by replacing, and says updated only for a change of substance', () => {
		const update = JSON.parse(updateBody('https://bw20.nl/log/quiet/', post, new Date('2026-11-01T08:00:00.123Z'))) as { action: string; url: string; replace: Record<string, unknown> };
		expect(update.action).toBe('update');
		expect(update.url).toBe('https://bw20.nl/log/quiet/');
		expect(update.replace.updated).toEqual(['2026-11-01T08:00:00Z']);
		expect(update.replace['mp-slug']).toBeUndefined();
		expect((JSON.parse(updateBody('u', post, null)) as { replace: Record<string, unknown> }).replace.updated).toBeUndefined();
	});

	it('withdraws and restores by the post\'s address', () => {
		expect(JSON.parse(actionBody('delete', 'https://bw20.nl/log/quiet/'))).toEqual({ action: 'delete', url: 'https://bw20.nl/log/quiet/' });
	});
});

describe('failure', () => {
	it('says what the site said, or its status', () => {
		expect(failure(answer('{"error": "invalid_request", "error_description": "log/quiet: index.md: missing summary"}', {}, 400))).toBe('log/quiet: index.md: missing summary');
		expect(failure(answer('{"error": "forbidden"}', {}, 403))).toBe('forbidden (403)');
		expect(failure(answer('<html>', {}, 502))).toBe('the site answered 502');
	});
});

describe('images', () => {
	const note = 'One ![A bed](<C:/v/bed.png>) and ![](</v/no alt.jpg>){width=300px}, ![A bed](<C:/v/bed.png>) again.';

	it('lists each image once, alt text and all', () => {
		expect(images(note)).toEqual([
			{ alt: 'A bed', path: 'C:/v/bed.png' },
			{ alt: '', path: '/v/no alt.jpg' },
		]);
	});

	it('swaps an image\'s file for its address', () => {
		expect(withAddresses(note, new Map([['C:/v/bed.png', 'https://bw20.nl/micropub/media/abc.png']]))).toBe(
			'One ![A bed](<https://bw20.nl/micropub/media/abc.png>) and ![](</v/no alt.jpg>){width=300px}, ![A bed](<https://bw20.nl/micropub/media/abc.png>) again.',
		);
	});

	it('knows which images a site takes', () => {
		expect(imageType('a.PNG')).toBe('image/png');
		expect(imageType('a.jpeg')).toBe('image/jpeg');
		expect(imageType('a.gif')).toBeNull();
	});

	it('wraps an image as multipart/form-data', () => {
		const body = new TextDecoder().decode(multipart('bed "1".png', 'image/png', new Uint8Array([104, 105]), 'XYZ'));
		expect(body).toBe('--XYZ\r\nContent-Disposition: form-data; name="file"; filename="bed _1_.png"\r\nContent-Type: image/png\r\n\r\nhi\r\n--XYZ--\r\n');
	});
});
