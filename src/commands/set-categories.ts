// Set categories: the note's categories, picked from the ones the site has,
// or a new one, which the site makes when the post is published.
import type { TFile } from 'obsidian';
import { postProperties } from 'obsidian-citation-core';
import { categoryChoices } from '../core/micropub';
import { categoriesOf } from '../site';
import { pickCategories } from '../ui/category-picker';
import { showing, site, writeProperties } from './publish';
import type { Context } from '../context';

export async function setCategories(context: Context, file: TFile): Promise<void> {
	const { app } = context;
	// A site that doesn't list its categories offers none: the note's own, and
	// a new one, are still there to set.
	const known = await showing('Asking your site for its categories…', async () => categoriesOf(await site(context)));
	const choices = categoryChoices(postProperties(app.metadataCache.getFileCache(file)?.frontmatter).categories, known ?? []);
	const chosen = await pickCategories(app, file.basename, choices, known !== null);
	if (chosen === null) return;
	await writeProperties(context, file, (frontmatter) => {
		frontmatter.categories = chosen;
	});
}
