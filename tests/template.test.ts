import { describe, expect, it } from 'vitest';
import { fill, noteName, POST_TEMPLATE } from '../src/core/template';

describe('the post template', () => {
	it('fills in the title, and leaves a placeholder it does not know', () => {
		expect(fill('# {{ Title }} {{date}}', { title: 'Quiet' })).toBe('# Quiet {{date}}');
		expect(fill(POST_TEMPLATE.content, { title: 'Quiet' })).toContain('# Quiet\n');
	});

	it('starts with the properties a post needs', () => {
		expect(POST_TEMPLATE.content.startsWith('---\nsummary:\ncategories: []\n---\n')).toBe(true);
	});

	it('names a note without the characters a file or a link cannot have', () => {
		expect(noteName('NixOS: a quiet revolution?')).toBe('NixOS a quiet revolution');
		expect(noteName(' [[x]] ')).toBe('x');
	});
});
