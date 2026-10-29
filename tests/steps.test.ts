import { describe, expect, it } from 'vitest';
import type { Post, Source } from '../src/core/micropub';
import { asksWhatKind, changes, draftOnSite, draftRefusal, imageRefusal, saysUnshown, sentStatus, unshownList, updatedNotice, updateSummary, whenUnchanged, type Send } from '../src/core/steps';

const url = 'https://bw20.nl/log/beds/';
const fresh: Send = { name: 'Beds', host: 'bw20.nl', draft: false, existing: null, wasDraft: false };
const published: Send = { ...fresh, existing: url };
const draftOnline: Send = { ...fresh, existing: url, wasDraft: true };
const body: Post = { title: 'Beds', summary: 'On beds.', content: { markdown: 'Text.' }, categories: [], slug: null, references: null, status: null };

describe('draftOnSite', () => {
	it('is a draft only on a site that takes drafts', () => {
		expect(draftOnSite(true, { draft: true })).toBe(true);
		expect(draftOnSite(false, { draft: true })).toBe(false);
		expect(draftOnSite(true, { draft: false })).toBe(false);
		expect(draftOnSite(true, null)).toBe(false);
	});
});

describe('draftRefusal', () => {
	it("refuses a draft to a site that doesn't take drafts", () => {
		expect(draftRefusal({ ...fresh, draft: true }, false)).toBe(
			"bw20.nl doesn't say that it takes drafts, so In the Open didn't send this one. A site that doesn't know about drafts would publish it straight away. You can publish Beds instead.",
		);
	});

	it('refuses to make a published post a draft again', () => {
		expect(draftRefusal({ ...published, draft: true }, true)).toBe(`Beds is published already, at ${url}, so it can't be a draft again. Publish it to update it.`);
	});

	it('lets a new draft, an updated draft and any publish go', () => {
		expect(draftRefusal({ ...fresh, draft: true }, true)).toBeNull();
		expect(draftRefusal({ ...draftOnline, draft: true }, true)).toBeNull();
		expect(draftRefusal(published, false)).toBeNull();
	});
});

describe('imageRefusal', () => {
	const bed = { alt: 'A raised bed', path: '/v/Attachments/bed.png' };

	it('asks for alt text first, naming the files', () => {
		expect(imageRefusal([{ alt: '', path: 'C:\\v\\bed.png' }, bed], 'bw20.nl', '/media')).toMatch(/^bed\.png has no alt text, /);
		expect(imageRefusal([{ alt: '', path: '/v/a.png' }, { alt: '', path: '/v/b.png' }], 'bw20.nl', '/media')).toMatch(/^a\.png and b\.png have no alt text, /);
	});

	it('only sends PNG and JPEG', () => {
		expect(imageRefusal([bed, { alt: 'A map', path: '/v/map.webp' }], 'bw20.nl', '/media')).toBe(
			"In the Open can only send PNG and JPEG images, and map.webp isn't one. Save it as PNG or JPEG, then embed that in the note instead.",
		);
	});

	it('needs somewhere to upload them', () => {
		expect(imageRefusal([bed], 'bw20.nl', null)).toMatch(/^This note has images, but bw20\.nl doesn't say where to upload them/);
		expect(imageRefusal([], 'bw20.nl', null)).toBeNull();
		expect(imageRefusal([bed], 'bw20.nl', '/media')).toBeNull();
	});
});

describe('sentStatus', () => {
	it('sends a draft as one, makes a draft public, and leaves the rest', () => {
		expect(sentStatus({ ...fresh, draft: true })).toBe('draft');
		expect(sentStatus(draftOnline)).toBe('published');
		expect(sentStatus(published)).toBeNull();
		expect(sentStatus(fresh)).toBeNull();
	});
});

describe('changes', () => {
	const online: Source = { draft: false, title: 'Beds', summary: 'On beds.', content: 'Text.' };

	it('compares an update with the post as the site has it', () => {
		expect(changes(published, body, online)).toEqual([]);
		expect(changes(published, { ...body, title: 'Raised beds' }, online)).toEqual(['the title']);
	});

	it('compares nothing for a new post, an unknown one, or a draft made public', () => {
		expect(changes(fresh, body, null)).toBeNull();
		expect(changes(published, body, null)).toBeNull();
		expect(changes(draftOnline, body, online)).toBeNull();
		expect(changes({ ...draftOnline, draft: true }, body, online)).toEqual([]);
	});
});

describe('whenUnchanged', () => {
	it('stops when nothing changed, asks when a picture might have, and sends otherwise', () => {
		expect(whenUnchanged([], 0)).toBe('up to date');
		expect(whenUnchanged([], 2)).toBe('ask');
		expect(whenUnchanged(['the title'], 0)).toBe('send');
		expect(whenUnchanged(null, 0)).toBe('send');
	});
});

describe('asksWhatKind', () => {
	it('asks only about an update of a published post', () => {
		expect(asksWhatKind(published)).toBe(true);
		expect(asksWhatKind(draftOnline)).toBe(false);
		expect(asksWhatKind(fresh)).toBe(false);
	});
});

describe('updateSummary', () => {
	it('says what changed, or that only pictures may have, or nothing to compare', () => {
		expect(updateSummary(url, ['the title', 'the text'])).toBe(`It's at ${url}. What changed: the title and the text.`);
		expect(updateSummary(url, [])).toBe(`It's at ${url}. Only its pictures may have changed.`);
		expect(updateSummary(url, null)).toBe(`It's at ${url}, and publishing it again replaces it there.`);
	});
});

describe('updatedNotice', () => {
	it('says what happened to a post the site had already', () => {
		expect(updatedNotice({ ...draftOnline, draft: true })).toMatch(/^Updated the draft of Beds\. If your site builds/);
		expect(updatedNotice(draftOnline)).toMatch(/^Published Beds\. It moves into your site's lists and feed\. /);
		expect(updatedNotice(published)).toMatch(/^Updated Beds\. If your site builds its pages first, it may take a moment to show\.$/);
	});
});

describe('saysUnshown', () => {
	const callout = [{ kind: 'callout' as const, written: ['[!tip] Title'] }];

	it('says it on a note\'s first send, when there is something to say', () => {
		expect(saysUnshown(fresh, callout)).toBe(true);
		expect(saysUnshown({ ...fresh, draft: true }, callout)).toBe(true);
		expect(saysUnshown(fresh, [])).toBe(false);
	});

	it('says nothing on an update, a draft published included', () => {
		expect(saysUnshown(published, callout)).toBe(false);
		expect(saysUnshown(draftOnline, callout)).toBe(false);
	});
});

describe('unshownList', () => {
	it('lists the first five, each on one line, and counts the rest', () => {
		expect(unshownList(['$$\n\\int x\n$$', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual({ items: ['$$ \\int x $$', 'b', 'c', 'd', 'e'], more: 2 });
		expect(unshownList(['==a=='])).toEqual({ items: ['==a=='], more: 0 });
	});

	it('cuts one that is long', () => {
		const { items } = unshownList([`[!note] ${'word '.repeat(20)}`]);
		expect(items[0]).toBe('[!note] word word word word word word word word word word w…');
	});
});
