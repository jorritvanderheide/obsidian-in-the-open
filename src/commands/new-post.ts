// New post: a note made from the post template, marked as a post, so its
// title bar offers to publish it.
import { normalizePath } from 'obsidian';
import { PublishError } from '../core/micropub';
import { STATUS_PROPERTY } from '../core/status';
import { fill, noteName, POST_TEMPLATE } from '../core/template';
import { ask } from '../ui/prompt';
import type { Context } from '../context';

export async function newPost(context: Context): Promise<void> {
	const { app } = context;
	const title = await ask(app, { title: 'New post', placeholder: 'Its title', cta: 'Create' });
	if (title === null) return;
	const name = noteName(title);
	if (name === '') throw new PublishError("A post's title needs letters or digits, for its note's name.");

	const folder = app.fileManager.getNewFileParent(app.workspace.getActiveFile()?.path ?? '');
	const path = normalizePath(`${folder.path}/${name}.md`);
	if (app.vault.getAbstractFileByPath(path)) throw new PublishError(`There's already a note at ${path}. Give the post another title.`);

	const body = fill(await template(context), { title });
	// With a frontmatter block, even an empty one: processFrontMatter decides
	// what to replace from the metadata cache, which hasn't seen a file this
	// new, and on a file without a block it can eat the first lines.
	const file = await app.vault.create(path, body.startsWith('---\n') ? body : `---\n---\n${body}`);
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		frontmatter[STATUS_PROPERTY] = 'unpublished';
	});
	await app.workspace.getLeaf(false).openFile(file);
}

/**
 * The template's text, seeded from the built-in copy when it isn't there.
 * Seeded on use rather than on load, so the plugin writes nothing into a
 * vault that hasn't asked for anything.
 */
async function template(context: Context): Promise<string> {
	const { app, settings } = context;
	const path = normalizePath(`${settings.templateFolder}/${POST_TEMPLATE.file}`);
	const existing = app.vault.getFileByPath(path);
	if (existing) return app.vault.cachedRead(existing);
	if (!app.vault.getFolderByPath(normalizePath(settings.templateFolder))) await app.vault.createFolder(normalizePath(settings.templateFolder));
	return app.vault.cachedRead(await app.vault.create(path, POST_TEMPLATE.content));
}
