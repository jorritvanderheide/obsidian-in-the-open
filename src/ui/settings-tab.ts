import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { FileSystemAdapter, PluginSettingTab, SecretComponent, type App, type SettingDefinitionItem } from 'obsidian';
import { cslPath, expandHome, settingPath } from 'obsidian-citation-core';
import { secure } from '../core/micropub';
import { loadSettings, type Settings } from '../core/settings';
import type InTheOpen from '../main';

export class SettingsTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: InTheOpen,
	) {
		super(app, plugin);
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof Settings];
	}

	/** Write a value back through the loader, so what is stored is what it would read. */
	async setControlValue(key: string, value: unknown): Promise<void> {
		this.plugin.settings = loadSettings({ ...this.plugin.settings, [key]: value });
		await this.plugin.saveSettings();
		this.update();
	}

	/** A setting that must agree with something outside the plugin says when it does not. */
	private fileStatus(value: string, stops: string): string {
		const adapter = this.app.vault.adapter;
		if (value === '' || !(adapter instanceof FileSystemAdapter)) return '';
		const path = settingPath(value, adapter.getBasePath(), homedir());
		return existsSync(path) ? '' : ` ⚠ There's no file at ${path}, so ${stops} until you fix or clear this.`;
	}

	private siteStatus(): string {
		const site = this.plugin.settings.site;
		return site === '' || secure(site) ? '' : ` ⚠ ${site} isn't https, so In the Open won't send it anything.`;
	}

	private cslStatus(): string {
		const value = this.plugin.settings.csl;
		if (value === '') return '';
		const home = homedir();
		const path = cslPath(expandHome(value, home), join(home, 'Zotero', 'styles'));
		return existsSync(path) ? '' : ` ⚠ There's no style at ${path}.`;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'Your site',
				items: [
					{
						name: 'Site',
						desc: "Your site's address, such as https://example.org. In the Open finds its Micropub endpoint from there." + this.siteStatus(),
						control: { type: 'text', key: 'site', placeholder: 'https://example.org' },
					},
					{
						name: 'Token',
						desc: "The token your site gave you, kept in Obsidian's keychain, not in this plugin's settings, so it doesn't travel with a vault you sync or commit.",
						render: (setting) => {
							setting.addComponent((el) =>
								new SecretComponent(this.app, el).setValue(this.plugin.settings.token).onChange((value) => {
									void this.setControlValue('token', value);
								}),
							);
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Posts',
				items: [
					{
						name: 'Template folder',
						desc: 'Where Post.md is, the template New post makes a note from. In the Open puts it there the first time, and after that it’s yours to edit.',
						control: { type: 'folder', key: 'templateFolder', placeholder: 'Templates/In the Open' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Pandoc',
				items: [
					{
						name: 'Pandoc',
						desc: "The pandoc program: its name if it's on your PATH, or its full path. Without one, In the Open offers to download pandoc's built-in version, once.",
						control: { type: 'text', key: 'pandocPath', placeholder: 'pandoc' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Citations',
				items: [
					{
						name: 'Bibliography',
						desc:
							'The .bib file Better BibTeX keeps up to date: a path in the vault, or outside it starting with / or ~. A link whose name is one of its keys is published as a citation. Leave it empty to publish without citations.' +
							this.fileStatus(this.plugin.settings.bibliography, 'publishing stops'),
						control: { type: 'text', key: 'bibliography', placeholder: 'Literature/library.bib' },
					},
					{
						name: 'Papers folder',
						desc: "Where your paper notes are. Before publishing, links to papers that aren't in the bibliography are listed, so a changed key can't quietly turn a citation into plain text.",
						control: { type: 'folder', key: 'literatureFolder', placeholder: 'Literature' },
					},
					{
						name: 'Citation key property',
						desc: 'The property that holds a paper note’s citation key. A link to a note with one cites that key, whatever the note is called. Paper Trail writes citekey.',
						control: { type: 'text', key: 'keyProperty', placeholder: 'citekey' },
					},
					{
						name: 'Citation style',
						desc: 'The name of a style Zotero has installed, such as apa or ieee, or the path to a .csl file. Leave it empty for Chicago author-date.' + this.cslStatus(),
						control: { type: 'text', key: 'csl', placeholder: 'Chicago author-date' },
					},
				],
			},
		];
	}
}
