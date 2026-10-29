import { describe, expect, it } from 'vitest';
import { actionBody, createBody, endpointFrom, failure, imageType, images, multipart, categoryChoices, differences, listed, readCategories, readConfig, readSource, secure, siteHost, onSite, postFormat, unknownCategories, updateBody, withAddresses, placeholders, withUploads, type Post, type Response } from '../src/core/micropub';

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
		expect(readConfig('{"media-endpoint": "https://bw20.nl/micropub/media", "references": 1}')).toEqual({ mediaEndpoint: 'https://bw20.nl/micropub/media', references: 1, drafts: false });
		expect(readConfig('{}')).toEqual({ mediaEndpoint: null, references: null, drafts: false });
		expect(readConfig('{"post-status": ["published", "draft"]}').drafts).toBe(true);
		expect(() => readConfig('<html>')).toThrow("can't read it (q=config)");
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
	status: null,
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

	it('sends post-status only for a draft, or a draft being published', () => {
		expect((JSON.parse(createBody({ ...post, status: 'draft' })) as { properties: Record<string, unknown> }).properties['post-status']).toEqual(['draft']);
		expect((JSON.parse(updateBody('u', { ...post, status: 'published' }, null)) as { replace: Record<string, unknown> }).replace['post-status']).toEqual(['published']);
		expect((JSON.parse(createBody(post)) as { properties: Record<string, unknown> }).properties['post-status']).toBeUndefined();
	});

	it('reads whether a post is a draft from its source', () => {
		expect(readSource('{"properties": {"post-status": ["draft"]}}').draft).toBe(true);
		expect(readSource('{"properties": {"post-status": ["published"]}}').draft).toBe(false);
		expect(readSource('{"properties": {}}')).toEqual({ draft: false });
		expect(() => readSource('<html>')).toThrow("can't read it (q=source)");
	});

	it('reads the post as the site has it, and only what it gave', () => {
		const source = readSource(
			JSON.stringify({
				type: ['h-entry'],
				properties: {
					name: ['Quiet'],
					content: [{ html: '<p>x</p>', value: 'x' }],
					category: ['tech', 3],
					references: [{ key: 'a', text: 'A.', url: '' }, { key: 'b' }],
				},
			}),
		);
		expect(source).toEqual({ draft: false, title: 'Quiet', content: '<p>x</p>', categories: ['tech'], references: [{ key: 'a', text: 'A.', url: null }] });
	});

	it('says to replace a change made on the site only when asked', () => {
		expect((JSON.parse(updateBody('u', post, null, true)) as Record<string, unknown>)['mp-overwrite']).toBe(true);
		expect((JSON.parse(updateBody('u', post, null)) as Record<string, unknown>)['mp-overwrite']).toBeUndefined();
	});

	it('withdraws and restores by the post\'s address', () => {
		expect(JSON.parse(actionBody('delete', 'https://bw20.nl/log/quiet/'))).toEqual({ action: 'delete', url: 'https://bw20.nl/log/quiet/' });
		expect(JSON.parse(actionBody('delete', 'u', ' The figures are wrong. '))).toEqual({ action: 'delete', url: 'u', reason: 'The figures are wrong.' });
		expect(JSON.parse(actionBody('undelete', 'u', 'ignored'))).toEqual({ action: 'undelete', url: 'u' });
	});
});

describe('failure', () => {
	it('says what the site said, or its status', () => {
		expect(failure(answer('{"error": "invalid_request", "error_description": "log/quiet: index.md: missing summary"}', {}, 400))).toBe('log/quiet: index.md: missing summary');
		expect(failure(answer('{"error": "forbidden"}', {}, 403))).toBe('forbidden (403)');
		expect(failure(answer('<html>', {}, 502))).toBe('error 502, with no reason given');
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

	it('keeps an image\'s title', () => {
		const titled = '![A bed](</v/bed.png> "In March")';
		expect(images(titled)).toEqual([{ alt: 'A bed', path: '/v/bed.png' }]);
		expect(withAddresses(titled, new Map([['/v/bed.png', 'https://bw20.nl/media/b.png']]))).toBe('![A bed](<https://bw20.nl/media/b.png> "In March")');
	});

	it('gives each file a placeholder, once, that pandoc leaves alone and none is part of another', () => {
		const pictures = Array.from({ length: 10 }, (_, i) => ({ alt: 'A', path: `/v/${i + 1}.png` }));
		const stand = placeholders([...pictures, { alt: 'Again', path: '/v/1.png' }, { alt: 'B', path: 'C:\\v\\bed.JPG' }]);
		expect(stand.size).toBe(11);
		expect(stand.get('/v/1.png')).toBe('https://in-the-open.invalid/image-1.png');
		expect(stand.get('C:\\v\\bed.JPG')).toBe('https://in-the-open.invalid/image-11.jpg');
	});

	it('puts each uploaded address where its placeholder was', () => {
		const stand = new Map([['/v/a.png', 'https://in-the-open.invalid/image-1.png'], ['/v/b.png', 'https://in-the-open.invalid/image-10.png']]);
		const addresses = new Map([['/v/a.png', 'https://bw20.nl/media/a.png'], ['/v/b.png', 'https://bw20.nl/media/b.png']]);
		const post = (text: string): Post => ({ title: 'T', summary: null, content: { html: text }, categories: [], slug: null, references: null, status: null });
		expect(withUploads(post('<img src="https://in-the-open.invalid/image-1.png"><img src="https://in-the-open.invalid/image-10.png">'), stand, addresses).content).toEqual({
			html: '<img src="https://bw20.nl/media/a.png"><img src="https://bw20.nl/media/b.png">',
		});
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

describe('differences', () => {
	const online = {
		draft: false,
		title: 'Quiet',
		summary: 'Why.',
		content: 'As [A 2024](#ref-a).\n\n![A bed](abcdef123456.png)\n',
		categories: ['tech'],
		references: [
			{ key: 'a', text: 'A, Ann. 2024. *First*.', url: 'https://doi.org/10.1/x' },
			{ key: 'b', text: 'B.', url: null },
		],
	};
	const note = { ...post, content: { markdown: 'As [A 2024](#ref-a).  \r\n\r\n![A bed](<https://bw20.nl/micropub/media/0123.png>)' } };

	it('finds nothing when only line endings, spaces and image addresses differ', () => {
		expect(differences(note, online)).toEqual([]);
	});

	it('names what changed', () => {
		const changed = { ...note, title: 'Loud', content: { markdown: 'As [A 2024](#ref-a), again.' }, categories: ['garden'], references: [] };
		expect(differences(changed, online)).toEqual(['the title', 'the text', 'the categories', 'the references']);
		expect(differences({ ...note, summary: null }, online)).toEqual(['the summary']);
		expect(differences({ ...note, content: { markdown: 'As [A 2024](#ref-a).\n\n![Another bed](x.png)' } }, online)).toEqual(['the text']);
	});

	it('compares only what the site gave', () => {
		expect(differences({ ...note, title: 'Loud' }, { draft: false })).toEqual([]);
	});

	it('compares HTML images by their alt text too', () => {
		const html = { ...note, content: { html: '<p><img src="https://bw20.nl/micropub/media/0123.png" alt="A bed"></p>' } };
		expect(differences(html, { draft: false, content: '<p><img alt="Another bed" src="/log/quiet/abc.png"></p>' })).toEqual(['the text']);
		expect(differences(html, { draft: false, content: '<p><img src="/log/quiet/abc.png" alt="A bed"></p>' })).toEqual([]);
	});
});

describe('listed', () => {
	it('puts things in a sentence', () => {
		expect(listed(['the text'])).toBe('the text');
		expect(listed(['the title', 'the text'])).toBe('the title and the text');
		expect(listed(['the title', 'the text', 'the summary'])).toBe('the title, the text and the summary');
	});
});

describe('categories', () => {
	it('reads the site’s categories, or nothing to check against', () => {
		expect(readCategories('{"categories": ["tech", "notes", 3]}')).toEqual(['tech', 'notes']);
		expect(readCategories('{}')).toBeNull();
		expect(readCategories('<html>')).toBeNull();
	});

	it('offers the site’s, on for the note’s, then the note’s the site doesn’t have', () => {
		expect(categoryChoices(['notes', 'cooking'], ['tech', 'notes'])).toEqual([
			{ name: 'tech', onSite: true, chosen: false },
			{ name: 'notes', onSite: true, chosen: true },
			{ name: 'cooking', onSite: false, chosen: true },
		]);
		expect(categoryChoices([], [])).toEqual([]);
	});

	it('finds the ones the site doesn’t have, each once', () => {
		expect(unknownCategories(['tech', 'cooking', 'Tech', 'cooking'], ['tech', 'notes'])).toEqual(['cooking', 'Tech']);
		expect(unknownCategories(['tech'], ['tech'])).toEqual([]);
	});
});

describe('siteHost', () => {
	it("is the site's host, for an https address", () => {
		expect(siteHost('https://bw20.nl')).toBe('bw20.nl');
		expect(siteHost('https://example.org:8443')).toBe('example.org:8443');
	});

	it('says what to set, before anything is asked or written', () => {
		expect(() => siteHost('')).toThrow("Set your site's address in Settings → In the Open first.");
		for (const site of ['bw20.nl', 'http://bw20.nl', 'not an address']) {
			expect(() => siteHost(site)).toThrow(`${site} isn't an address In the Open can publish to. Set your site's address in Settings → In the Open, starting with https://, as https://example.org.`);
		}
	});
});

describe('onSite', () => {
	it('is true for an address under the site, and not for the site itself or one that only starts alike', () => {
		expect(onSite('https://bw20.nl/log/quiet', 'https://bw20.nl')).toBe(true);
		expect(onSite('https://bw20.nl', 'https://bw20.nl')).toBe(false);
		expect(onSite('https://bw20.nl.example.org/log', 'https://bw20.nl')).toBe(false);
		expect(onSite('http://bw20.nl/log/quiet', 'https://bw20.nl')).toBe(false);
	});
});

describe('postFormat', () => {
	it('is Markdown for a site that takes the references extension, and HTML for any other', () => {
		expect(postFormat({ mediaEndpoint: null, references: 1, drafts: false })).toBe('markdown');
		expect(postFormat({ mediaEndpoint: null, references: null, drafts: true })).toBe('html');
	});
});
