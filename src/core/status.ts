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

/** What a command does to a note's post. */
export type Action = 'publish' | 'draft' | 'withdraw' | 'restore';

/**
 * Why `action` doesn't fit a post that stands at `status`, as a sentence about
 * the note called `name`, or null when it does. A withdrawn post is restored
 * before it is updated, and only a withdrawn one is restored: otherwise the
 * note would say one thing and the site another.
 */
export function refusal(action: Action, status: PostStatus | null, name: string): string | null {
	if (status === 'withdrawn' && (action === 'publish' || action === 'draft')) return `${name} is withdrawn. Restore it first, then publish it again to update it.`;
	if (status === 'withdrawn' && action === 'withdraw') return `${name} is withdrawn already.`;
	if (status !== 'withdrawn' && action === 'restore') return `${name} isn't withdrawn, so there's nothing to restore.`;
	return null;
}

/**
 * Whether another post may link to a post that stands at `status`. A draft's
 * address is only for whoever has it, so a link to a draft goes out as its
 * words until the draft is published. A withdrawn post's address keeps
 * working, and links to it still lead there.
 */
export function linkable(status: PostStatus | null): boolean {
	return status === 'published' || status === 'withdrawn';
}

/**
 * Whether a send makes a note public for the first time: a new post, or a
 * draft being published. Until then, the posts that link to it show its link
 * as words.
 */
export function goesPublic(existing: boolean, wasDraft: boolean, draft: boolean): boolean {
	return !draft && (!existing || wasDraft);
}

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
