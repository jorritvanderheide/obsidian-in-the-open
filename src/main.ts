import { debounce, Notice, Plugin, TFile } from 'obsidian';
import { newPost } from './commands/new-post';
import { postOf, publish, withdraw } from './commands/publish';
import { setCategories } from './commands/set-categories';
import { PublishError } from './core/micropub';
import { loadSettings, type Settings } from './core/settings';
import { SettingsTab } from './ui/settings-tab';
import { decorate, undecorate } from './ui/title-bar';

export default class InTheOpen extends Plugin {
	settings!: Settings;

	/** Notes being sent now, by path: their title bar offers no step until they're done. */
	private readonly sending = new Set<TFile>();
	private unloaded = false;

	async onload() {
		this.settings = loadSettings(await this.loadData());
		this.addSettingTab(new SettingsTab(this.app, this));

		this.addCommand({ id: 'new-post', name: 'New post', callback: () => this.attempt(newPost(this)) });

		// Publish any note; withdraw or restore only one that has a post.
		const commands: { id: string; name: string; icon: string; published: boolean; run: (file: TFile) => Promise<void> }[] = [
			{ id: 'publish', name: 'Publish note', icon: 'send', published: false, run: (file) => this.send(file, () => publish(this, file, false)) },
			{ id: 'draft', name: 'Publish note as a draft', icon: 'file-up', published: false, run: (file) => this.send(file, () => publish(this, file, true)) },
			{ id: 'withdraw', name: 'Withdraw note', icon: 'archive', published: true, run: (file) => this.send(file, () => withdraw(this, file, false)) },
			{ id: 'restore', name: 'Restore note', icon: 'archive-restore', published: true, run: (file) => this.send(file, () => withdraw(this, file, true)) },
			{ id: 'set-categories', name: 'Set categories', icon: 'tags', published: false, run: (file) => setCategories(this, file) },
		];
		const available = (file: TFile | null, published: boolean): file is TFile =>
			file?.extension === 'md' && (!published || postOf(this, file) !== null);

		for (const command of commands) {
			this.addCommand({
				id: command.id,
				name: command.name,
				checkCallback: (checking) => {
					const file = this.app.workspace.getActiveFile();
					if (!available(file, command.published)) return false;
					if (!checking) this.attempt(command.run(file));
					return true;
				},
			});
		}

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (!(file instanceof TFile)) return;
				for (const command of commands) {
					if (!available(file, command.published)) continue;
					menu.addItem((item) =>
						item
							.setTitle(command.name)
							.setIcon(command.icon)
							.setSection('action')
							.onClick(() => this.attempt(command.run(file))),
					);
				}
			}),
		);

		// The title bar follows the note: a view rebuilds its actions when it
		// switches between editing and reading, and a post's status changes in
		// its properties, which the metadata cache says.
		this.registerEvent(this.app.workspace.on('layout-change', () => this.decorate()));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.decorate()));
		this.registerEvent(this.app.workspace.on('file-open', () => this.decorate()));
		this.registerEvent(this.app.metadataCache.on('changed', () => this.decorate()));
		this.app.workspace.onLayoutReady(() => this.decorate());
	}

	onunload() {
		this.unloaded = true;
		undecorate(this.app);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Deferred, because `layout-change` fires before a view rebuilds its
	 * actions, and coalesced, because opening a note fires several events in a
	 * row.
	 */
	private readonly decorate = debounce(
		() => {
			if (this.unloaded) return;
			decorate(this.app, {
				publish: (file, draft) => this.attempt(this.send(file, () => publish(this, file, draft))),
				withdraw: (file, back) => this.attempt(this.send(file, () => withdraw(this, file, back))),
				busy: (file) => this.sending.has(file),
			});
		},
		20,
		true,
	);

	/**
	 * One send at a time for each note, from the title bar, a command or a menu:
	 * a second publish of a new note would make a second post. Kept by the note
	 * itself, not its path, so renaming it while it's sent changes nothing.
	 */
	private async send(file: TFile, start: () => Promise<void>): Promise<void> {
		if (this.sending.has(file)) {
			new Notice(`${file.basename} is still being sent. Wait until it's done, then try again.`, 5000);
			return;
		}
		this.sending.add(file);
		this.decorate();
		try {
			await start();
		} finally {
			this.sending.delete(file);
			this.decorate();
		}
	}

	/** Every failure becomes a notice. A rejection left unhandled is swallowed, and a publish that failed looks like one that never started. */
	private attempt(done: Promise<void>) {
		done.catch((error: unknown) => {
			if (!(error instanceof PublishError)) console.error(error);
			new Notice(error instanceof Error ? error.message : String(error), 0);
		});
	}
}
