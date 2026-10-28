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
		return existsSync(path) ? '' : ` ⚠ There's no file at ${path}. ${stops} until you fix or clear this.`;
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
						desc: "Your site's address, such as https://example.org. In the Open looks on its home page for where to send posts." + this.siteStatus(),
						control: { type: 'text', key: 'site', placeholder: 'https://example.org' },
					},
					{
						name: 'Token',
						desc: "The token your site gave you. Obsidian keeps it in its keychain, apart from this plugin's settings, so it stays behind when you sync or commit your vault.",
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
						desc: "Leave it as pandoc to use an installed pandoc, which In the Open finds by itself, or set the full path to one. If there's none, In the Open offers to download pandoc's built-in version, once.",
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
							'The .bib file Better BibTeX keeps up to date. It can be in your vault, or anywhere else with a path that starts with / or ~. A link to one of its citation keys, like [[marsh2024]], is published as a citation. Leave it empty to publish without citations.' +
							this.fileStatus(this.plugin.settings.bibliography, 'Publishing stops'),
						control: { type: 'text', key: 'bibliography', placeholder: 'Literature/library.bib' },
					},
					{
						name: 'Papers folder',
						desc: "Where your paper notes are. Before you publish, In the Open lists any link to a paper that isn't in your bibliography, so a changed key can't quietly turn a citation into plain text.",
						control: { type: 'folder', key: 'literatureFolder', placeholder: 'Literature' },
					},
					{
						name: 'Citation key property',
						desc: 'The property that holds a paper note’s citation key. A link to a paper note cites its key, whatever the note is called. Paper Trail writes citekey.',
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
