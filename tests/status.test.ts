import { describe, expect, it } from 'vitest';
import { refusal, statusOf } from '../src/core/status';

describe('statusOf', () => {
	it('knows a note that is no post', () => {
		expect(statusOf(undefined)).toBeNull();
		expect(statusOf({ tags: ['x'] })).toBeNull();
	});

	it('reads where a post stands', () => {
		expect(statusOf({ 'post-status': 'unpublished' })).toBe('unpublished');
		expect(statusOf({ 'post-status': 'draft', 'published-url': 'https://bw20.nl/log/a/' })).toBe('draft');
		expect(statusOf({ 'post-status': 'withdrawn', 'published-url': 'https://bw20.nl/log/a/' })).toBe('withdrawn');
	});

	it('is published with an address and no status, as a note published before there was one', () => {
		expect(statusOf({ 'published-url': 'https://bw20.nl/log/a/' })).toBe('published');
		expect(statusOf({ 'published-url': 'https://bw20.nl/log/a/', 'post-status': 'nonsense' })).toBe('published');
	});

	it('is unpublished without an address, whatever its status says', () => {
		expect(statusOf({ 'post-status': 'draft' })).toBe('unpublished');
		expect(statusOf({ 'post-status': 'published', 'published-url': ' ' })).toBe('unpublished');
	});
});

describe('refusal', () => {
	it('restores a withdrawn post before it is updated, and only a withdrawn one', () => {
		expect(refusal('publish', 'withdrawn', 'Notes')).toBe('Notes is withdrawn. Restore it first, then publish it again to update it.');
		expect(refusal('draft', 'withdrawn', 'Notes')).toBe('Notes is withdrawn. Restore it first, then publish it again to update it.');
		expect(refusal('withdraw', 'withdrawn', 'Notes')).toBe('Notes is withdrawn already.');
		expect(refusal('restore', 'published', 'Notes')).toBe("Notes isn't withdrawn, so there's nothing to restore.");
		expect(refusal('restore', 'draft', 'Notes')).toBe("Notes isn't withdrawn, so there's nothing to restore.");
	});

	it('lets the rest through', () => {
		for (const status of [null, 'unpublished', 'draft', 'published'] as const) {
			expect(refusal('publish', status, 'Notes')).toBeNull();
			expect(refusal('draft', status, 'Notes')).toBeNull();
		}
		expect(refusal('withdraw', 'published', 'Notes')).toBeNull();
		expect(refusal('withdraw', 'draft', 'Notes')).toBeNull();
		expect(refusal('restore', 'withdrawn', 'Notes')).toBeNull();
	});
});
