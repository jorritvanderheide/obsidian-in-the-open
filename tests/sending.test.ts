import { describe, expect, it } from 'vitest';
import { forgotten, moved, readSending, sent } from '../src/core/sending';

describe('readSending', () => {
	it('keeps paths with a time, and nothing else', () => {
		expect(readSending({ 'Posts/Beds.md': '2026-10-28T20:00:00.000Z', 'Posts/Odd.md': 3 })).toEqual({ 'Posts/Beds.md': '2026-10-28T20:00:00.000Z' });
		expect(readSending(null)).toEqual({});
		expect(readSending('nonsense')).toEqual({});
		expect(readSending(['Posts/Beds.md'])).toEqual({});
	});
});

describe('sent, forgotten and moved', () => {
	const at = new Date('2026-10-28T20:00:00.000Z');

	it('remembers a send, and forgets it', () => {
		const sending = sent({}, 'Posts/Beds.md', at);
		expect(sending).toEqual({ 'Posts/Beds.md': '2026-10-28T20:00:00.000Z' });
		expect(forgotten(sending, 'Posts/Beds.md')).toEqual({});
		expect(forgotten(sending, 'Posts/Other.md')).toEqual(sending);
	});

	it('follows a note that was renamed or moved', () => {
		const sending = sent({}, 'Posts/Beds.md', at);
		expect(moved(sending, 'Posts/Beds.md', 'Garden/Raised beds.md')).toEqual({ 'Garden/Raised beds.md': '2026-10-28T20:00:00.000Z' });
		expect(moved(sending, 'Posts/Other.md', 'Posts/New.md')).toBe(sending);
	});
});
