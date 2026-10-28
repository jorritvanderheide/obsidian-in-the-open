// Where a note's post stands, from the note's own properties: the frontmatter
// is the record, so a note says what it is wherever it is opened. Pure, so the
// title bar and the commands read it the same way.

/** The property that holds a published note's post, its address. */
export const POST_PROPERTY = 'published-url';

/** The property that says where the post stands. */
export const STATUS_PROPERTY = 'post-status';

/** A note made with New post starts unpublished; publishing moves it on. */
export type PostStatus = 'unpublished' | 'draft' | 'published' | 'withdrawn';

const STATUSES: PostStatus[] = ['unpublished', 'draft', 'published', 'withdrawn'];

/**
 * Where the note's post stands, or null for a note that isn't a post.
 *
 * A note is a post when it has either property. Without an address it is
 * unpublished, whatever its status says. With one and no status, as a note
 * published before there was a status, it is published.
 */
export function statusOf(frontmatter: Record<string, unknown> | undefined): PostStatus | null {
	const url = frontmatter?.[POST_PROPERTY];
	const status = frontmatter?.[STATUS_PROPERTY];
	const hasUrl = typeof url === 'string' && url.trim() !== '';
	if (!hasUrl) return status === undefined ? null : 'unpublished';
	return STATUSES.includes(status as PostStatus) && status !== 'unpublished' ? (status as PostStatus) : 'published';
}
