import { describe, expect, it } from 'vitest';
import { statusOf } from '../src/core/status';

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
