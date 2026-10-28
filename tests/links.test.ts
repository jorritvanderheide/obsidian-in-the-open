import { describe, expect, it } from 'vitest';
import { linkingPosts } from '../src/core/links';
import type { PostStatus } from '../src/core/status';

describe('linkingPosts', () => {
	const statuses: Record<string, PostStatus> = {
		'Posts/Compost.md': 'published',
		'Posts/Raised beds.md': 'published',
		'Posts/Mulch.md': 'draft',
		'Posts/Old.md': 'withdrawn',
	};
	const statusAt = (path: string) => statuses[path] ?? null;

	it('finds the published posts that link to a note, sorted', () => {
		const links = {
			'Posts/Raised beds.md': { 'Posts/Soil.md': 2 },
			'Posts/Compost.md': { 'Posts/Soil.md': 1, 'Posts/Raised beds.md': 1 },
			'Notes/Idea.md': { 'Posts/Soil.md': 1 },
		};
		expect(linkingPosts('Posts/Soil.md', links, statusAt)).toEqual(['Posts/Compost.md', 'Posts/Raised beds.md']);
	});

	it('leaves out drafts, withdrawn posts, the note itself, and posts that link elsewhere', () => {
		const links = {
			'Posts/Mulch.md': { 'Posts/Soil.md': 1 },
			'Posts/Old.md': { 'Posts/Soil.md': 1 },
			'Posts/Compost.md': { 'Posts/Soil.md': 0, 'Posts/Raised beds.md': 1 },
			'Posts/Soil.md': { 'Posts/Soil.md': 1 },
			'Canvas.canvas': { 'Posts/Soil.md': 1 },
		};
		expect(linkingPosts('Posts/Soil.md', links, statusAt)).toEqual([]);
	});
});
