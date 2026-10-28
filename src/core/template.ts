// The post template the plugin ships, and what New post fills in. The file
// in the template folder wins when it is there, and is written from here when
// it isn't: edits to it stick, and a deleted one comes back. Content only, so
// the tests can read it; the seeding is in commands/new-post.ts.

/**
 * A post's properties, ready to fill in, and its title as its heading.
 * `summary` is the sentence a site shows under the title, and `categories`
 * are the site's, such as its threads.
 */
export const POST_TEMPLATE = {
	file: 'Post.md',
	content: `---
summary:
categories: []
---

# {{title}}

`,
};

/** The template with each `{{name}}` it knows filled in. Case and spaces inside the braces don't matter, and one it doesn't know stays, so a typo shows. */
export function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (whole, name: string) => values[name.toLowerCase()] ?? whole);
}

/** A note's file name for a title: without the characters a file name or a link can't have. */
export function noteName(title: string): string {
	return title
		.replace(/[\\/:*?"<>|#^[\]]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
