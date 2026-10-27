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
import { actionBody, createBody, imageType, images, multipart, PublishError, updateBody, withAddresses, type Post } from '../core/micropub';
import { send } from '../http';
import { connect, post, upload, type Site } from '../site';
import { choose, confirm } from '../ui/confirm';
import type { Context } from '../context';

/** The property that holds a published note's post, its address. */
export const POST_PROPERTY = 'published-url';

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

export async function publish(context: Context, file: TFile): Promise<void> {
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

	const progress = new Notice(`Asking ${new URL(settings.site).host} what it takes…`, 0);
	let target: Site;
	try {
		target = await site(context);
	} finally {
		progress.hide();
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
	if (pictures.length > 0 && media === null) throw new PublishError(`${new URL(settings.site).host} takes no images (it has no media endpoint), and this note has some.`);

	const existing = postOf(context, file);
	let updated: Date | null = null;
	if (existing !== null) {
		const answer = await choose(
			app,
			`Update ${file.basename}?`,
			(el) => {
				el.createEl('p', { text: `It's at ${existing}, and publishing it again replaces it there.` });
				el.createEl('p', { text: "Did it change in substance? Then the post says it was updated. A correction, such as a typo, doesn't." });
			},
			['Just a correction', 'Changed in substance'],
		);
		if (answer === null) return;
		if (answer === 1) updated = new Date();
	}

	const sending = new Notice(`Publishing ${file.basename}…`, 0);
	let response;
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
				);
			} catch (error) {
				if (error instanceof ExportError) throw new PublishError(error.message.replace('the Due Credit settings', 'Settings → In the Open'));
				throw error;
			}
			return {
				content: await readFile(output, 'utf8'),
				references: format === 'markdown' && existsSync(files.references) ? readReferences(await readFile(files.references, 'utf8')) : null,
			};
		});

		const properties = postProperties(app.metadataCache.getFileCache(file)?.frontmatter);
		const title = typeof prepared.metadata.title === 'string' ? prepared.metadata.title : file.basename;
		const body: Post = {
			title,
			summary: properties.summary,
			content: format === 'markdown' ? { markdown: content } : { html: content },
			categories: properties.categories,
			slug: properties.slug,
			references,
		};
		response = await post(target, existing === null ? createBody(body) : updateBody(existing, body, updated));
	} finally {
		sending.hide();
	}

	if (existing !== null) {
		new Notice(`Updated ${file.basename}. The site shows it once it has built it.`, 10000);
		return;
	}
	const location = response.headers.location;
	if (location === undefined) throw new PublishError(`${new URL(settings.site).host} took the post but didn't say where it is.`);
	const url = new URL(location, target.endpoint).href;
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		frontmatter[POST_PROPERTY] = url;
	});
	if (response.status === 202) await waitForIt(file.basename, url);
	else live(file.basename, url);
}

/** Withdraw the note's post, or bring it back. */
export async function withdraw(context: Context, file: TFile, back: boolean): Promise<void> {
	const url = postOf(context, file);
	if (url === null) throw new PublishError(`${file.basename} isn't published: it has no ${POST_PROPERTY}.`);
	if (!back) {
		const yes = await confirm(
			context.app,
			`Withdraw ${file.basename}?`,
			(el) => el.createEl('p', { text: `It leaves your site's lists and feed. Its address, ${url}, keeps working, so links and citations to it still lead somewhere.` }),
			'Withdraw',
		);
		if (!yes) return;
	}
	const target = await site(context);
	await post(target, actionBody(back ? 'undelete' : 'delete', url));
	new Notice(back ? `Restored ${file.basename}.` : `Withdrew ${file.basename}.`, 10000);
}

/** Ask for the new post until it answers, and say when it's up, or that it isn't yet. */
async function waitForIt(name: string, url: string): Promise<void> {
	const waiting = new Notice(`Sent ${name}. Waiting for the site to put it up…`, 0);
	const until = Date.now() + WAIT;
	try {
		while (Date.now() < until) {
			await new Promise((resolve) => window.setTimeout(resolve, 5000));
			const answer = await send(url).catch(() => null);
			if (answer?.status === 200) {
				live(name, url);
				return;
			}
		}
	} finally {
		waiting.hide();
	}
	new Notice(`${name} isn't up yet after ${WAIT / 60_000} minutes. The site took it, so it may still be building: look at ${url} later.`, 0);
}

function live(name: string, url: string): void {
	const fragment = createFragment((el) => {
		el.createDiv({ text: `${name} is live` });
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
