// Set categories: the note's categories, picked from the ones the site has,
// so a post is never refused for one it doesn't.
import { Notice, type TFile } from 'obsidian';
import { postProperties } from 'obsidian-citation-core';
import { categoryChoices, PublishError } from '../core/micropub';
import { categoriesOf } from '../site';
import { pickCategories } from '../ui/category-picker';
import { showing, site, writeProperties } from './publish';
import type { Context } from '../context';

export async function setCategories(context: Context, file: TFile): Promise<void> {
	const { app } = context;
	const known = await showing('Asking your site for its categories…', async () => categoriesOf(await site(context)));
	const host = new URL(context.settings.site).host;
	if (known === null) {
		throw new PublishError(`${host} doesn't list its categories, so In the Open can't offer them. Write them in the note's categories property.`);
	}
	const choices = categoryChoices(postProperties(app.metadataCache.getFileCache(file)?.frontmatter).categories, known);
	if (choices.length === 0) {
		new Notice(`${host} has no categories yet.`, 10000);
		return;
	}
	const chosen = await pickCategories(app, file.basename, choices);
	if (chosen === null) return;
	await writeProperties(context, file, (frontmatter) => {
		frontmatter.categories = chosen;
	});
}
