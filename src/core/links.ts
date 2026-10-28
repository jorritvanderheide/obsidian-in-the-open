// Which posts link to a note: the ones to update once it has a post of its
// own. Pure, so it's tested with plain objects.
import type { PostStatus } from './status';

/**
 * The notes with a published post that link to the note at `path`, by path,
 * sorted. `links` is Obsidian's resolved links: for every note, the files its
 * links lead to, and how often. A note's link to itself doesn't count. Nor does
 * a draft's, which picks up the link when it's published, or a withdrawn
 * post's, which is restored before it's updated.
 */
export function linkingPosts(path: string, links: Record<string, Record<string, number>>, statusAt: (path: string) => PostStatus | null): string[] {
	return Object.keys(links)
		.filter((source) => source !== path && source.endsWith('.md') && (links[source]?.[path] ?? 0) > 0 && statusAt(source) === 'published')
		.sort();
}
