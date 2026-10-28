// Publish a note: read it, make it a post, send it to the site, and keep the
// post's address in the note.
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { basename, delimiter, dirname, join } from 'path';
import { FileSystemAdapter, MarkdownView, Notice, parseYaml, type TFile } from 'obsidian';
import {
	bibKeys,
	cslPath,
	expandHome,
	ExportError,
	lineBreaks,
	noteStyle,
	postArgs,
	postProperties,
	prepare,
	readReferences,
	run,
	settingPath,
	withFiles,
	type Missing,
	type Post as Format,
	type Vault,
} from 'obsidian-citation-core';
import { actionBody, ConflictError, createBody, differences, imageType, images, listed, multipart, PublishError, unknownCategories, updateBody, withAddresses, type Post, type Source } from '../core/micropub';
import { send } from '../http';
import { categoriesOf, connect, isDraft, post, sourceOf, upload, type Site } from '../site';
import { choose, confirm } from '../ui/confirm';
import { ask } from '../ui/prompt';
import { POST_PROPERTY, STATUS_PROPERTY, type PostStatus } from '../core/status';
import type { Context } from '../context';

/** How long a new post may take to go live before In the Open stops waiting. */
const WAIT = 5 * 60_000;

/** The site, with its token from Obsidian's keychain. */
export async function site(context: Context): Promise<Site> {
	const { app, settings } = context;
	if (settings.site === '') throw new PublishError("Set your site's address in Settings → In the Open first.");
	// Trimmed, as the receiver trims its own copy: a token pasted with a line
	// break after it is still the same token.
	const token = settings.token === '' ? null : (app.secretStorage.getSecret(settings.token)?.trim() ?? null);
	if (token === null || token === '') throw new PublishError("Choose your site's token in Settings → In the Open first.");
	return connect(settings.site, token);
}

/** The address of the note's post, or null when it has none. */
export function postOf(context: Context, file: TFile): string | null {
	const value: unknown = context.app.metadataCache.getFileCache(file)?.frontmatter?.[POST_PROPERTY];
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Publish a note, or send it as a draft, which only its address leads to until it's published. */
export async function publish(context: Context, file: TFile, draft: boolean): Promise<void> {
	const { app, settings } = context;
	const adapter = app.vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) throw new PublishError('Publishing needs the desktop app.');
	const vault = adapter.getBasePath();
	const home = homedir();

	const bibliography = settings.bibliography ? settingPath(settings.bibliography, vault, home) : null;
	if (bibliography && !existsSync(bibliography)) {
		throw new PublishError(`There's no bibliography at ${bibliography}. Point the Bibliography setting at your Better BibTeX export, or clear it to publish without citations.`);
	}
	const csl = settings.csl ? cslPath(expandHome(settings.csl, home), join(home, 'Zotero', 'styles')) : null;
	if (csl && !existsSync(csl)) {
		throw new PublishError(`There's no citation style at ${csl}. Use the name of a style Zotero has installed, such as apa, or the path to a .csl file.`);
	}

	// Asked for before anything is sent, and kept in the note, so it's asked
	// once. The metadata cache may not have the new property yet when the post
	// is put together, so the answer is used as it is.
	let summary = postProperties(app.metadataCache.getFileCache(file)?.frontmatter).summary;
	if (summary === null) {
		summary = await ask(app, {
			title: `A summary for ${file.basename}`,
			description: 'One sentence about the post, which your site shows under its title and in its feed. It goes in the note as its summary property.',
			placeholder: 'What the post is about',
			cta: 'Save',
		});
		if (summary === null) return;
		const answer = summary;
		await writeProperties(context, file, (frontmatter) => {
			frontmatter.summary = answer;
		});
	}

	const host = new URL(settings.site).host;
	const existing = postOf(context, file);
	const progress = new Notice(`Asking ${host} what it takes…`, 0);
	let target: Site;
	let online: Source | null;
	// Checked against the site before anything is made or sent: a category it
	// doesn't have would be refused only after the images and pandoc.
	const categories = postProperties(app.metadataCache.getFileCache(file)?.frontmatter).categories;
	let known: string[] | null = null;
	try {
		target = await site(context);
		online = existing === null ? null : await sourceOf(target, existing);
		if (categories.length > 0) known = await categoriesOf(target);
	} finally {
		progress.hide();
	}
	const unknown = known === null ? [] : unknownCategories(categories, known);
	// A new category is often a typo of one the site has, so it's asked about,
	// with the ones it has to compare.
	if (known !== null && unknown.length > 0) {
		const one = unknown.length === 1;
		const yes = await confirm(
			app,
			one ? 'A new category' : 'New categories',
			(el) => {
				el.createEl('p', {
					text: `${host} has no ${one ? 'category' : 'categories'} ${listed(unknown)} yet. Publishing ${file.basename} adds ${one ? 'it' : 'them'}, if your site takes new ones.`,
				});
				el.createEl('p', { text: known.length > 0 ? `It has ${listed(known)}.` : 'It has none yet.' });
			},
			'Publish',
		);
		if (!yes) return;
	}
	const wasDraft = target.config.drafts && online?.draft === true;
	if (draft && !target.config.drafts) {
		throw new PublishError(`${host} takes no drafts: it doesn't say so in its Micropub configuration, and a site that doesn't know drafts publishes one at once.`);
	}
	if (draft && existing !== null && !wasDraft) {
		throw new PublishError(`${file.basename} is published already, at ${existing}, so it can't be a draft again. Publish it to update it.`);
	}
	const format: Format = target.config.references !== null ? 'markdown' : 'html';

	// The editor rather than the file when the note is open, since the file
	// can be a couple of seconds behind what you just typed.
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const text = view?.file === file ? view.editor.getValue() : await app.vault.read(file);
	const lookup: Vault = {
		resolve: (linkpath) => {
			const dest = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
			if (!dest) return null;
			return { path: dest.path, file: adapter.getFullPath(dest.path), frontmatter: app.metadataCache.getFileCache(dest)?.frontmatter };
		},
		parseYaml: (yaml) => {
			try {
				return parseYaml(yaml) as unknown;
			} catch {
				throw new PublishError(`The properties of ${file.basename} aren't valid YAML, so it can't be published. Fix them in source mode, where Obsidian shows what's wrong.`);
			}
		},
	};
	// Only a post on this site: a note published somewhere else is a note
	// without a post here.
	const linkedPost = (linkpath: string) => {
		const dest = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
		const url = dest ? postOf(context, dest) : null;
		return url !== null && url.startsWith(`${settings.site}/`) ? url : null;
	};
	const prepared = prepare(text, lookup, {
		name: file.basename,
		papersFolder: settings.literatureFolder,
		keyProperty: settings.keyProperty,
		keys: bibliography ? bibKeys(await readFile(bibliography, 'utf8')) : null,
		noteStyle: csl !== null && noteStyle(await readFile(csl, 'utf8')),
		post: format,
		postOf: linkedPost,
	});
	const { missing } = prepared;
	const lost = missing.papers.length + missing.unresolved.length + missing.unpublished.length;
	if (lost > 0 && !(await confirmMissing(context, missing, lost, bibliography ? basename(bibliography) : 'your bibliography'))) return;

	const pictures = images(prepared.markdown);
	const blind = pictures.filter((image) => image.alt === '');
	if (blind.length > 0) {
		throw new PublishError(
			`Every image on a website needs alt text, saying what it shows, and ${blind.map((image) => basename(image.path)).join(', ')} has none. Write it after a |, as ![[bed.png|A raised bed in March]].`,
		);
	}
	const other = pictures.filter((image) => imageType(image.path) === null);
	if (other.length > 0) throw new PublishError(`A site takes PNG and JPEG images, and ${other.map((image) => basename(image.path)).join(', ')} isn't one.`);
	const media = target.config.mediaEndpoint;
	if (pictures.length > 0 && media === null) throw new PublishError(`${host} takes no images (it has no media endpoint), and this note has some.`);

	const making = new Notice(`Preparing ${file.basename}…`, 0);
	let body: Post;
	try {
		const addresses = new Map<string, string>();
		for (const image of pictures) {
			const data = await readFile(image.path);
			addresses.set(image.path, await upload(target, media ?? '', (boundary) => multipart(basename(image.path), imageType(image.path) ?? '', data, boundary)));
		}
		const markdown = withAddresses(prepared.markdown, addresses);

		let appConfig: unknown = null;
		try {
			appConfig = JSON.parse(await adapter.read(`${app.vault.configDir}/app.json`));
		} catch {
			// No app.json, or one that does not parse: Obsidian's defaults.
		}
		const { content, references } = await withFiles(prepared.metadata, async (files) => {
			const output = join(dirname(files.references), `post${format === 'markdown' ? '.md' : '.html'}`);
			try {
				await run(
					settings.pandocPath,
					postArgs(format, {
						...files,
						bibliography,
						csl,
						resourcePath: [vault, dirname(adapter.getFullPath(file.path))].join(delimiter),
						hardLineBreaks: lineBreaks(appConfig),
						output,
					}),
					markdown,
					vault,
					'Settings → In the Open',
				);
			} catch (error) {
				// Already a sentence: the core's own kind of failure, said as In the Open's.
				if (error instanceof ExportError) throw new PublishError(error.message);
				throw error;
			}
			return {
				content: await readFile(output, 'utf8'),
				references: format === 'markdown' && existsSync(files.references) ? readReferences(await readFile(files.references, 'utf8')) : null,
			};
		});

		const properties = postProperties(app.metadataCache.getFileCache(file)?.frontmatter);
		const title = typeof prepared.metadata.title === 'string' ? prepared.metadata.title : file.basename;
		body = {
			title,
			summary,
			content: format === 'markdown' ? { markdown: content } : { html: content },
			categories: properties.categories,
			slug: properties.slug,
			references,
			status: draft ? 'draft' : wasDraft ? 'published' : null,
		};
	} finally {
		making.hide();
	}

	// An update is compared with the post as the site has it, except a draft
	// being published, whose status is the change.
	const changed = existing !== null && online !== null && !(wasDraft && !draft) ? differences(body, online) : null;
	if (changed !== null && changed.length === 0) {
		if (pictures.length === 0) {
			new Notice(`${file.basename} is up to date: your site has it as the note has it.`, 10000);
			return;
		}
		const anyway = await confirm(
			app,
			`${file.basename} hasn't changed`,
			(el) =>
				el.createEl('p', {
					text: "Your site has it as the note has it, apart from its pictures, which In the Open can't compare. Send it anyway, for a picture you changed?",
				}),
			'Send anyway',
		);
		if (!anyway) return;
	}

	// A draft has nothing to say it was updated: only a published post does.
	let updated: Date | null = null;
	if (existing !== null && !wasDraft) {
		const answer = await choose(
			app,
			`Update ${file.basename}?`,
			(el) => {
				el.createEl('p', {
					text:
						changed === null
							? `It's at ${existing}, and publishing it again replaces it there.`
							: changed.length === 0
								? `It's at ${existing}. Only its pictures may have changed.`
								: `It's at ${existing}. What changed: ${listed(changed)}.`,
				});
				el.createEl('p', { text: "Did it change in substance? Then the post says it was updated. A correction, such as a typo, doesn't." });
			},
			['Just a correction', 'Changed in substance'],
		);
		if (answer === null) return;
		if (answer === 1) updated = new Date();
	}

	const sendingText = draft ? `Sending the draft of ${file.basename}…` : `Publishing ${file.basename}…`;
	const send = (overwrite: boolean) => showing(sendingText, () => post(target, existing === null ? createBody(body) : updateBody(existing, body, updated, overwrite)));
	let response;
	try {
		response = await send(false);
	} catch (error) {
		// Changed on the site since it was last sent: replacing that is asked.
		if (!(error instanceof ConflictError) || existing === null) throw error;
		const replace = await confirm(
			app,
			`${file.basename} was changed on your site`,
			(el) => {
				el.createEl('p', { text: `Since you last published it, it was changed there: ${error.message}.` });
				el.createEl('p', { text: 'Publishing it again replaces that change with the note. To keep the change, bring it into the note first.' });
			},
			'Replace it',
		);
		if (!replace) return;
		response = await send(true);
	}

	if (existing !== null) {
		const done = draft
			? `Updated the draft of ${file.basename}.`
			: wasDraft
				? `Published ${file.basename}: it goes into your site's lists and feed.`
				: `Updated ${file.basename}.`;
		await record(context, file, draft ? 'draft' : 'published');
		new Notice(`${done} The site shows it once it has built it.`, 10000);
		return;
	}
	const location = response.headers.location;
	if (location === undefined) throw new PublishError(`${host} took the post but didn't say where it is.`);
	const url = new URL(location, target.endpoint).href;
	await record(context, file, draft ? 'draft' : 'published', url);
	// Waited for on its own, with its own notices: what's next for the note, such
	// as publishing its draft, is offered at once rather than after the build.
	if (response.status === 202) void waitForIt(file.basename, url, draft);
	else live(file.basename, url, draft);
}

/** Withdraw the note's post, or bring it back. A draft is discarded instead. */
export async function withdraw(context: Context, file: TFile, back: boolean): Promise<void> {
	const url = postOf(context, file);
	if (url === null) throw new PublishError(`${file.basename} isn't published: it has no ${POST_PROPERTY}.`);
	// Asking the site comes before any dialog, so it says so: it can take a
	// moment, and a command that shows nothing looks like one that didn't run.
	const { target, draft } = await showing(`Asking your site about ${file.basename}…`, async () => {
		const target = await site(context);
		return { target, draft: !back && (await isDraft(target, url)) };
	});
	if (draft) {
		const yes = await confirm(
			context.app,
			`Discard the draft of ${file.basename}?`,
			(el) => el.createEl('p', { text: `It was never published, so your site deletes it, and the note forgets its address, ${url}.` }),
			'Discard',
		);
		if (!yes) return;
		await showing(`Discarding the draft of ${file.basename}…`, () => post(target, actionBody('delete', url)));
		await record(context, file, 'unpublished', null);
		new Notice(`Discarded the draft of ${file.basename}.`, 10000);
		return;
	}
	let reason = '';
	if (!back) {
		const answer = await ask(context.app, {
			title: `Withdraw ${file.basename}?`,
			description: `It leaves your site's lists and feed, and its page says it was withdrawn, above its text. Its address, ${url}, keeps working, so links and citations to it still lead there. Say why, and the page says that too.`,
			placeholder: 'Why, for its readers (optional)',
			cta: 'Withdraw',
			optional: true,
		});
		if (answer === null) return;
		reason = answer;
	}
	// The site checks, commits and pushes before it answers, which takes a few
	// seconds.
	await showing(back ? `Restoring ${file.basename}…` : `Withdrawing ${file.basename}…`, () =>
		post(target, actionBody(back ? 'undelete' : 'delete', url, reason)),
	);
	await record(context, file, back ? 'published' : 'withdrawn');
	new Notice(`${back ? 'Restored' : 'Withdrew'} ${file.basename}. The site shows it once it has built it.`, 10000);
}

/** A notice that stays while the work runs, and goes when it's done or fails. */
export async function showing<T>(text: string, work: () => Promise<T>): Promise<T> {
	const notice = new Notice(text, 0);
	try {
		return await work();
	} finally {
		notice.hide();
	}
}

/** Write where the note's post stands, and its address: a new one, or null to forget it. */
function record(context: Context, file: TFile, status: PostStatus, url?: string | null): Promise<void> {
	return writeProperties(context, file, (frontmatter) => {
		if (url === null) delete frontmatter[POST_PROPERTY];
		else if (url !== undefined) frontmatter[POST_PROPERTY] = url;
		frontmatter[STATUS_PROPERTY] = status;
	});
}

/**
 * Change the note's properties, after saving every editor that has it open.
 *
 * An editor with typing it hasn't saved yet, or that another plugin is
 * rewriting on save, holds a different note from the file. Writing the file
 * under it makes Obsidian merge the two, and a merge of two edited
 * properties blocks once left a note with two of them. Saved first, the
 * editor and the file agree, and there is nothing to merge.
 */
export async function writeProperties(context: Context, file: TFile, change: (frontmatter: Record<string, unknown>) => void): Promise<void> {
	const { app } = context;
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (leaf.view instanceof MarkdownView && leaf.view.file === file) await leaf.view.save();
	}
	await app.fileManager.processFrontMatter(file, change);
}

/**
 * Ask for the new post until it answers, and say when it's up, or that it
 * isn't yet. Never fails: a request that goes wrong is one more try.
 */
async function waitForIt(name: string, url: string, draft: boolean): Promise<void> {
	const waiting = new Notice(`Sent ${name}. Waiting for the site to put it up…`, 0);
	const until = Date.now() + WAIT;
	try {
		while (Date.now() < until) {
			await new Promise((resolve) => window.setTimeout(resolve, 5000));
			const answer = await send(url).catch(() => null);
			if (answer?.status === 200) {
				live(name, url, draft);
				return;
			}
		}
	} finally {
		waiting.hide();
	}
	new Notice(`${name} isn't up yet after ${WAIT / 60_000} minutes. The site took it, so it may still be building: look at ${url} later.`, 0);
}

function live(name: string, url: string, draft: boolean): void {
	const fragment = createFragment((el) => {
		el.createDiv({ text: draft ? `The draft of ${name} is up, and only its address leads to it` : `${name} is live` });
		el.createEl('a', { text: url, href: url });
	});
	new Notice(fragment, 15000);
}

function confirmMissing(context: Context, missing: Missing, count: number, bib: string): Promise<boolean> {
	const list = (el: HTMLElement, items: string[]) => {
		const ul = el.createEl('ul');
		for (const item of items) ul.createEl('li').createEl('code', { text: item });
	};
	return confirm(
		context.app,
		count === 1 ? "A link won't be one on your site" : `${count} links won't be links on your site`,
		(el) => {
			if (missing.unpublished.length > 0) {
				el.createEl('p', { text: "These link to notes you haven't published, so they'll show as their words:" });
				list(el, missing.unpublished);
				el.createEl('p', { text: 'Publish them first, and their links go to their posts.' });
			}
			if (missing.papers.length > 0) {
				el.createEl('p', { text: `These link to papers that ${bib} doesn't have, so they'll show as plain names instead of citations:` });
				list(el, missing.papers);
				el.createEl('p', { text: "Usually Better BibTeX changed the key, or its auto-export hasn't run since you added the paper." });
			}
			if (missing.unresolved.length > 0) {
				el.createEl('p', { text: `These don't link to a note, and ${bib} has no key with their name either, so they'll show as plain text:` });
				list(el, missing.unresolved);
			}
		},
		'Publish anyway',
	);
}
