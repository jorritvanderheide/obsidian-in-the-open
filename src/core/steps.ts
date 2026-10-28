// What publishing does next, decided from what the note and the site say.
// Pure, so every turn of a publish is tested without Obsidian or a site:
// src/commands/publish.ts asks the questions, sends and writes.
import { differences, imageType, listed, type Image, type Post, type Source } from './micropub';

/** One send of a note, as the steps below need it. */
export interface Send {
	/** The note's name. */
	name: string;
	/** The site's host, as messages name it. */
	host: string;
	/** Whether this send is a draft. */
	draft: boolean;
	/** The post's address, or null for a new post. */
	existing: string | null;
	/** Whether the site has the post as a draft, so that publishing it makes it public. */
	wasDraft: boolean;
}

/** Whether the site has the post as a draft. Only a site that takes drafts has any. */
export function draftOnSite(takesDrafts: boolean, online: Source | null): boolean {
	return takesDrafts && online?.draft === true;
}

/**
 * Why this send can't go, or null when it can. A site that doesn't know about
 * drafts would publish one straight away, and a published post never goes
 * back to being a draft.
 */
export function draftRefusal(send: Send, takesDrafts: boolean): string | null {
	if (send.draft && !takesDrafts) {
		return `${send.host} doesn't say that it takes drafts, so In the Open didn't send this one. A site that doesn't know about drafts would publish it straight away. You can publish ${send.name} instead.`;
	}
	if (send.draft && send.existing !== null && !send.wasDraft) {
		return `${send.name} is published already, at ${send.existing}, so it can't be a draft again. Publish it to update it.`;
	}
	return null;
}

/** The last part of a path, on any platform. */
function fileName(path: string): string {
	return path.split(/[\\/]/).at(-1) ?? path;
}

/**
 * Why the note's images can't be sent, or null when they can: each needs alt
 * text, has to be PNG or JPEG, and needs a site that takes uploads.
 */
export function imageRefusal(pictures: Image[], host: string, mediaEndpoint: string | null): string | null {
	const blind = pictures.filter((image) => image.alt === '');
	if (blind.length > 0) {
		return `${listed(blind.map((image) => fileName(image.path)))} ${blind.length === 1 ? 'has' : 'have'} no alt text, the words a reader gets when they can't see an image. Write a few about what it shows after a |, like ![[bed.png|A raised bed in March]].`;
	}
	const other = pictures.filter((image) => imageType(image.path) === null);
	if (other.length > 0) {
		const one = other.length === 1;
		return `In the Open can only send PNG and JPEG images, and ${listed(other.map((image) => fileName(image.path)))} ${one ? "isn't one" : "aren't"}. Save ${one ? 'it' : 'them'} as PNG or JPEG, then embed ${one ? 'that' : 'those'} in the note instead.`;
	}
	if (pictures.length > 0 && mediaEndpoint === null) {
		return `This note has images, but ${host} doesn't say where to upload them, so In the Open can't send them. Your site needs a Micropub media endpoint for images.`;
	}
	return null;
}

/** The status the request sets: a draft, a draft made public, or neither. */
export function sentStatus(send: Send): 'draft' | 'published' | null {
	return send.draft ? 'draft' : send.wasDraft ? 'published' : null;
}

/**
 * What an update changes in the post as the site has it, or null when there's
 * nothing to compare: a new post, a post the site didn't describe, or a draft
 * being published, whose status is the change.
 */
export function changes(send: Send, body: Post, online: Source | null): string[] | null {
	return send.existing !== null && online !== null && !(send.wasDraft && !send.draft) ? differences(body, online) : null;
}

/**
 * What to do about an update that changes nothing the site can show: stop, and
 * say so; ask, since a picture may have changed and that can't be seen; or
 * send, because something changed, or nothing was compared.
 */
export function whenUnchanged(changed: string[] | null, pictures: number): 'up to date' | 'ask' | 'send' {
	if (changed === null || changed.length > 0) return 'send';
	return pictures === 0 ? 'up to date' : 'ask';
}

/** Whether to ask if an update is a real change. Only a published post says it was updated; a draft has nothing to say it. */
export function asksWhatKind(send: Send): boolean {
	return send.existing !== null && !send.wasDraft;
}

/** What the update question says about the post, before it asks what kind of change this is. */
export function updateSummary(existing: string, changed: string[] | null): string {
	if (changed === null) return `It's at ${existing}, and publishing it again replaces it there.`;
	if (changed.length === 0) return `It's at ${existing}. Only its pictures may have changed.`;
	return `It's at ${existing}. What changed: ${listed(changed)}.`;
}

/** The notice after a post the site had already is sent again. */
export function updatedNotice(send: Send): string {
	const done = send.draft ? `Updated the draft of ${send.name}.` : send.wasDraft ? `Published ${send.name}. It moves into your site's lists and feed.` : `Updated ${send.name}.`;
	return `${done} If your site builds its pages first, it may take a moment to show.`;
}
