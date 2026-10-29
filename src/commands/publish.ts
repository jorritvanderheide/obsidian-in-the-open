// Publish a note: read it, make it a post, send it to the site, and keep the
// post's address in the note.
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { basename, dirname, join } from 'path';
import { FileSystemAdapter, MarkdownView, Notice, parseYaml, requestUrl, type App, type TFile } from 'obsidian';
import {
	bibKeys,
	BUILT_IN,
	builtInFolder,
	cslPath,
	expandHome,
	ExportError,
	lineBreaks,
	noteStyle,
	postArgs,
	postProperties,
	prepare,
	readReferences,
	pandocFor,
	seen,
	settingPath,
	withFiles,
	type Missing,
	type Post as Format,
	type Vault,
} from 'obsidian-citation-core';
import { actionBody, ConflictError, createBody, imageType, images, listed, multipart, placeholders, PublishError, RefusedError, siteHost, unknownCategories, updateBody, withAddresses, withUploads, type Post, type Source } from '../core/micropub';
import { send } from '../http';
import { categoriesOf, connect, isDraft, post, sourceOf, upload, type Site } from '../site';
import { choose, confirm } from '../ui/confirm';
import { ask } from '../ui/prompt';
import { linkingPosts } from '../core/links';
import { forgotten, moved, readSending, sent, type Sending } from '../core/sending';
import { asksWhatKind, changes, draftOnSite, draftRefusal, imageRefusal, sentStatus, updatedNotice, updateSummary, whenUnchanged, type Send } from '../core/steps';
import { goesPublic, linkable, POST_PROPERTY, refusal, STATUS_PROPERTY, statusOf, type PostStatus } from '../core/status';
import type { Context } from '../context';

/** How long a new post may take to go live before In the Open stops waiting. */
const WAIT = 5 * 60_000;

/** The site, with its token from Obsidian's keychain. */
export async function site(context: Context): Promise<Site> {
	const { app, settings } = context;
	siteHost(settings.site);
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

/**
 * Publish a note, or send it as a draft, which only its address leads to until
 * it's published. True when this made the note public for the first time.
 */
export async function publish(context: Context, file: TFile, draft: boolean): Promise<boolean> {
	const { app, settings } = context;
	const adapter = app.vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) throw new PublishError('Publishing needs the desktop app.');
	// Checked before the summary is asked for and written into the note.
	const host = siteHost(settings.site);
	const refused = refusal(draft ? 'draft' : 'publish', statusOf(app.metadataCache.getFileCache(file)?.frontmatter), file.basename);
	if (refused !== null) throw new PublishError(refused);
	// A new post sent before, whose address never came back into the note, may
	// be on the site already, so it's asked about before a second one is made.
	if (postOf(context, file) !== null) forget(app, file.path);
	else if (sendingOf(app)[file.path] !== undefined) {
		const answer = await choose(
			app,
			`Is ${file.basename} on your site already?`,
			(el) => {
				el.createEl('p', { text: `The last time you published ${file.basename}, its address didn't make it back into the note. The post may be on your site already.` });
				el.createEl('p', { text: "If it is, give its address, and the note knows its post again. Publishing it as new could make a second post, or your site may turn it down." });
			},
			['Publish it as new', 'Give its address'],
		);
		if (answer === null) return false;
		if (answer === 1) {
			await relink(context, file, host);
			return false;
		}
		forget(app, file.path);
	}
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
			description: 'One sentence about the post, for your site to show under its title and in its feed. In the Open saves it in the note, as its summary property.',
			placeholder: 'What the post is about',
			cta: 'Save',
		});
		if (summary === null) return false;
		const answer = summary;
		await writeProperties(context, file, (frontmatter) => {
			frontmatter.summary = answer;
		});
	}

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
					text: `${host} has no ${one ? 'category' : 'categories'} ${listed(unknown)} yet. If your site takes new categories, publishing ${file.basename} adds ${one ? 'it' : 'them'}.`,
				});
				el.createEl('p', { text: known.length > 0 ? `In case it's a typo, these are the ones it has: ${listed(known)}.` : 'It has no categories yet.' });
			},
			'Publish',
		);
		if (!yes) return false;
	}
	const sending: Send = { name: file.basename, host, draft, existing, wasDraft: draftOnSite(target.config.drafts, online) };
	const { wasDraft } = sending;
	const refusedDraft = draftRefusal(sending, target.config.drafts);
	if (refusedDraft !== null) throw new PublishError(refusedDraft);
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
				throw new PublishError(`The properties of ${file.basename} can't be read, so it can't be published. Open the note in source mode, where Obsidian shows what's wrong with them.`);
			}
		},
	};
	// Only a post on this site: a note published somewhere else is a note
	// without a post here.
	const linkedPost = (linkpath: string) => {
		const dest = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
		const url = dest && linkable(statusOf(app.metadataCache.getFileCache(dest)?.frontmatter)) ? postOf(context, dest) : null;
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
	if (lost > 0 && !(await confirmMissing(context, missing, lost, bibliography ? basename(bibliography) : 'your bibliography'))) return false;

	const pictures = images(prepared.markdown);
	const media = target.config.mediaEndpoint;
	const refusedImages = imageRefusal(pictures, host, media);
	if (refusedImages !== null) throw new PublishError(refusedImages);

	// Asked for before anything is uploaded, since the built-in pandoc may
	// have to be downloaded first, which you may not want.
	const pandoc = await pandocToRun(app, settings.pandocPath, vault);
	if (pandoc === null) return false;

	// Each image is uploaded only once the post is sure to go. Until then a
	// placeholder stands in for it, which the comparison ignores.
	const stand = placeholders(pictures);
	const making = new Notice(`Preparing ${file.basename}…`, 0);
	let body: Post;
	try {
		const markdown = withAddresses(prepared.markdown, stand);

		let appConfig: unknown = null;
		try {
			appConfig = JSON.parse(await adapter.read(`${app.vault.configDir}/app.json`));
		} catch {
			// No app.json, or one that does not parse: Obsidian's defaults.
		}
		const { content, references } = await withFiles(prepared.metadata, async (files) => {
			const output = join(dirname(files.references), `post${format === 'markdown' ? '.md' : '.html'}`);
			try {
				await pandoc.run(
					postArgs(
						format,
						seen(
							{
								...files,
								bibliography,
								csl,
								resourcePath: [vault, dirname(adapter.getFullPath(file.path))].map((dir) => pandoc.see(dir)).join(pandoc.delimiter),
								hardLineBreaks: lineBreaks(appConfig),
								output,
							},
							(path) => pandoc.see(path),
						),
					),
					markdown,
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
			status: sentStatus(sending),
		};
	} finally {
		making.hide();
	}

	const changed = changes(sending, body, online);
	const unchanged = whenUnchanged(changed, pictures.length);
	if (unchanged !== 'send') {
		if (unchanged === 'up to date') {
			new Notice(`${file.basename} is up to date. Your site already has it just as it is in the note.`, 10000);
			return false;
		}
		const anyway = await confirm(
			app,
			`${file.basename} hasn't changed`,
			(el) =>
				el.createEl('p', {
					text: "As far as In the Open can tell, your site already has it just as it is in the note. It can't see whether a picture changed, so if you changed one, send it anyway.",
				}),
			'Send anyway',
		);
		if (!anyway) return false;
	}

	let updated: Date | null = null;
	if (existing !== null && asksWhatKind(sending)) {
		const answer = await choose(
			app,
			`Update ${file.basename}?`,
			(el) => {
				el.createEl('p', {
					text: updateSummary(existing, changed),
				});
				el.createEl('p', { text: "Is this a real change, or a small correction such as a typo? After a real change, the post says it was updated. After a correction, it doesn't." });
			},
			['Just a correction', 'A real change'],
		);
		if (answer === null) return false;
		if (answer === 1) updated = new Date();
	}

	if (stand.size > 0) {
		const addresses = await showing(`Uploading ${stand.size === 1 ? 'an image' : `${stand.size} images`}…`, async () => {
			const uploaded = new Map<string, string>();
			for (const path of stand.keys()) {
				const data = await readFile(path);
				uploaded.set(path, await upload(target, media ?? '', (boundary) => multipart(basename(path), imageType(path) ?? '', data, boundary)));
			}
			return uploaded;
		});
		body = withUploads(body, stand, addresses);
	}

	const sendingText = draft ? `Sending the draft of ${file.basename}…` : `Publishing ${file.basename}…`;
	const send = (overwrite: boolean) => showing(sendingText, () => post(target, existing === null ? createBody(body) : updateBody(existing, body, updated, overwrite)));
	// Until the note has its new post's address: if that never happens, the
	// next publish asks before it makes a second post.
	if (existing === null) remember(app, file.path);
	let response;
	try {
		response = await send(false);
	} catch (error) {
		// Turned down, so there is no post to lose track of.
		if (existing === null && error instanceof RefusedError) forget(app, file.path);
		// Changed on the site since it was last sent: replacing that is asked.
		if (!(error instanceof ConflictError) || existing === null) throw error;
		const replace = await confirm(
			app,
			`${file.basename} was changed on your site`,
			(el) => {
				el.createEl('p', { text: `It was changed on your site since you last published it, by hand or by another tool. Your site says: ${error.message}.` });
				el.createEl('p', { text: 'Replacing it sends the note as it is, and that change is lost. To keep the change, copy it into the note first, then publish again.' });
			},
			'Replace it',
		);
		if (!replace) return false;
		response = await send(true);
	}

	if (existing !== null) {
		await record(context, file, draft ? 'draft' : 'published');
		new Notice(updatedNotice(sending), 10000);
		return goesPublic(true, wasDraft, draft);
	}
	// The post is on the site from here on: a note that doesn't learn its
	// address would make a second post the next time it's published.
	const location = response.headers.location;
	let url: string;
	try {
		url = new URL(location ?? '', target.endpoint).href;
		if (location === undefined) throw new Error('no Location');
	} catch {
		throw new PublishError(`${host} took the post but didn't say where it is, so ${file.basename} doesn't know its address. Find the post on your site and put its address in the note's ${POST_PROPERTY} property. Publishing again without it would make a second post.`);
	}
	try {
		await record(context, file, draft ? 'draft' : 'published', url);
		forget(app, file.path);
	} catch (error) {
		throw new PublishError(`${file.basename} is on your site, at ${url}, but its address couldn't be written into the note: ${error instanceof Error ? error.message : String(error)}. Put the address in the note's ${POST_PROPERTY} property yourself. Publishing again without it would make a second post.`);
	}
	// Waited for on its own, with its own notices: what's next for the note, such
	// as publishing its draft, is offered at once rather than after the build.
	if (response.status === 202) void waitForIt(file.basename, url, draft);
	else live(file.basename, url, draft);
	return goesPublic(false, false, draft);
}

/** Withdraw the note's post, or bring it back. A draft is discarded instead. */
export async function withdraw(context: Context, file: TFile, back: boolean): Promise<void> {
	const url = postOf(context, file);
	if (url === null) throw new PublishError(`${file.basename} isn't published. It has no ${POST_PROPERTY} property.`);
	const refused = refusal(back ? 'restore' : 'withdraw', statusOf(context.app.metadataCache.getFileCache(file)?.frontmatter), file.basename);
	if (refused !== null) throw new PublishError(refused);
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
			(el) => el.createEl('p', { text: `It was never published, so your site deletes it, and In the Open removes its address from the note (${url}).` }),
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
			description: `It leaves your site's lists and feed, and its page says it was withdrawn. Its address, ${url}, keeps working, so links and citations to it still lead there. If you say why, your site can show that on the page too.`,
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
	new Notice(`${back ? 'Restored' : 'Withdrew'} ${file.basename}. If your site builds its pages first, it may take a moment to show.`, 10000);
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
/**
 * The posts to update now that `file` is public, after asking: the published
 * posts that link to it, which show that link as words. Empty when there are
 * none, or the answer is no.
 */
export async function linkingToUpdate(context: Context, file: TFile): Promise<TFile[]> {
	const { app } = context;
	await settled(app, file);
	const statusAt = (path: string) => {
		const note = app.vault.getFileByPath(path);
		return note === null ? null : statusOf(app.metadataCache.getFileCache(note)?.frontmatter);
	};
	const posts = linkingPosts(file.path, app.metadataCache.resolvedLinks, statusAt)
		.map((path) => app.vault.getFileByPath(path))
		.filter((note): note is TFile => note !== null);
	if (posts.length === 0) return [];
	const one = posts.length === 1;
	const update = await confirm(
		app,
		one ? `A post links to ${file.basename}` : `${posts.length} posts link to ${file.basename}`,
		(el) => {
			el.createEl('p', {
				text: one
					? `It went out before ${file.basename} had a post, and shows the link as plain words. Update it, and the link leads to the new post:`
					: `They went out before ${file.basename} had a post, and show the links as plain words. Update them, and the links lead to the new post:`,
			});
			const ul = el.createEl('ul');
			for (const post of posts) ul.createEl('li', { text: post.basename });
			el.createEl('p', {
				text: one
					? "It's sent as its note is now, with any other changes you've made since. You'll get the usual questions for an update."
					: "Each is sent as its note is now, with any other changes you've made since. You'll get the usual questions for an update, one post at a time.",
			});
		},
		one ? 'Update it' : 'Update them',
	);
	return update ? posts : [];
}

/**
 * Until the metadata cache has the note's new address and status, which the
 * links to it are read by, or a few seconds at most.
 */
function settled(app: App, file: TFile): Promise<void> {
	const ready = () => linkable(statusOf(app.metadataCache.getFileCache(file)?.frontmatter));
	if (ready()) return Promise.resolve();
	return new Promise((resolve) => {
		const done = () => {
			app.metadataCache.offref(ref);
			window.clearTimeout(timer);
			resolve();
		};
		const ref = app.metadataCache.on('changed', (changed) => {
			if (changed === file && ready()) done();
		});
		const timer = window.setTimeout(done, 5000);
	});
}

/**
 * Link the note to a post it lost track of, at the address you give, once that
 * address shows a page on your site. Its status is asked of the site, since a
 * draft has a page too.
 */
async function relink(context: Context, file: TFile, host: string): Promise<void> {
	const { app, settings } = context;
	const answer = await ask(app, {
		title: `Where is ${file.basename}?`,
		description: "Find the post on your site, and paste its address here. In the Open checks that it's there before it writes it into the note.",
		placeholder: `${settings.site}/…`,
		cta: 'Link it',
	});
	if (answer === null) return;
	const url = answer.trim();
	if (!url.startsWith(`${settings.site}/`)) throw new PublishError(`${url} isn't an address on ${host}. Paste the address of the post on your site, starting with ${settings.site}/.`);
	const page = await showing(`Looking for ${file.basename} on ${host}…`, () => send(url).catch(() => null));
	if (page?.status !== 200) throw new PublishError(`There's no post at ${url}, or ${host} didn't show it. Open the address in a browser to check it, then try again.`);
	const draft = await isDraft(await site(context), url);
	await record(context, file, draft ? 'draft' : 'published', url);
	forget(app, file.path);
	new Notice(`${file.basename} knows its post again, at ${url}. Publish it again to update the post with what's in the note.`, 10000);
}

/** Where the new posts sent without hearing back are kept: this vault's local storage, on this device. */
const SENDING = 'in-the-open-sending';

function sendingOf(app: App): Sending {
	return readSending(app.loadLocalStorage(SENDING));
}

function keep(app: App, sending: Sending): void {
	app.saveLocalStorage(SENDING, Object.keys(sending).length > 0 ? sending : null);
}

function remember(app: App, path: string): void {
	keep(app, sent(sendingOf(app), path, new Date()));
}

function forget(app: App, path: string): void {
	const sending = sendingOf(app);
	if (sending[path] !== undefined) keep(app, forgotten(sending, path));
}

/** A note renamed or moved keeps what was remembered about its send. */
export function noteMoved(app: App, from: string, to: string): void {
	const sending = sendingOf(app);
	if (sending[from] !== undefined) keep(app, moved(sending, from, to));
}

/** A note deleted takes what was remembered about its send with it. */
export function noteDeleted(app: App, path: string): void {
	forget(app, path);
}

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
	new Notice(`${name} still isn't up after ${WAIT / 60_000} minutes. Your site took it, so it's probably still being built. Have a look at ${url} in a while.`, 0);
}

function live(name: string, url: string, draft: boolean): void {
	const fragment = createFragment((el) => {
		el.createDiv({ text: draft ? `The draft of ${name} is up. Only people with its address can find it:` : `${name} is live` });
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
		count === 1 ? 'A link will be plain text on your site' : `${count} links will be plain text on your site`,
		(el) => {
			if (missing.unpublished.length > 0) {
				el.createEl('p', { text: "These link to notes you haven't published, or only sent as a draft. Your post will show their words, without a link:" });
				const ul = el.createEl('ul');
				for (const { words, note } of missing.unpublished) {
					const li = ul.createEl('li');
					li.createEl('code', { text: words });
					if (words !== note) li.appendText(`, which links to ${note}`);
				}
				el.createEl('p', { text: "When you publish one of those notes, In the Open offers to update this post, so its link goes there." });
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

/**
 * The pandoc the **Pandoc** setting asks for. Without an installed one, the
 * built-in one, which is asked about and downloaded the first time; null when
 * that's declined.
 */
async function pandocToRun(app: App, setting: string, vault: string) {
	let downloading: Notice | null = null;
	try {
		return await pandocFor(
			setting,
			vault,
			'Settings → In the Open',
			async () => {
				const yes = await confirm(
					app,
					'Download pandoc?',
					(el) => {
						el.createEl('p', { text: "In the Open turns a note into a post with pandoc, and it can't find pandoc installed on this computer." });
						el.createEl('p', {
							text: `It can download pandoc ${BUILT_IN.version} for you, once, from pandoc's own release on GitHub (${BUILT_IN.megabytes} MB). It's kept in ${builtInFolder()}, outside your vault, and runs inside Obsidian. To use your own pandoc instead, install it, or set its full path in Settings → In the Open, then publish again.`,
						});
					},
					'Download',
				);
				if (yes) downloading = new Notice(`Downloading pandoc ${BUILT_IN.version}…`, 0);
				return yes;
			},
			async (url) => (await requestUrl({ url })).arrayBuffer,
		);
	} catch (error) {
		if (error instanceof ExportError) throw new PublishError(error.message);
		throw new PublishError(`Couldn't download pandoc: ${error instanceof Error ? error.message : String(error)}. Try again, or install pandoc.`);
	} finally {
		(downloading as Notice | null)?.hide();
	}
}
