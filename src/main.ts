import { Notice, Plugin, TFile } from 'obsidian';
import { postOf, publish, withdraw } from './commands/publish';
import { PublishError } from './core/micropub';
import { loadSettings, type Settings } from './core/settings';
import { SettingsTab } from './ui/settings-tab';

export default class InTheOpen extends Plugin {
	settings!: Settings;

	async onload() {
		this.settings = loadSettings(await this.loadData());
		this.addSettingTab(new SettingsTab(this.app, this));

		// Publish any note; withdraw or restore only one that has a post.
		const commands: { id: string; name: string; icon: string; published: boolean; run: (file: TFile) => Promise<void> }[] = [
			{ id: 'publish', name: 'Publish note', icon: 'send', published: false, run: (file) => publish(this, file) },
			{ id: 'withdraw', name: 'Withdraw note', icon: 'archive', published: true, run: (file) => withdraw(this, file, false) },
			{ id: 'restore', name: 'Restore note', icon: 'archive-restore', published: true, run: (file) => withdraw(this, file, true) },
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Every failure becomes a notice. A rejection left unhandled is swallowed, and a publish that failed looks like one that never started. */
	private attempt(done: Promise<void>) {
		done.catch((error: unknown) => {
			if (!(error instanceof PublishError)) console.error(error);
			new Notice(error instanceof Error ? error.message : String(error), 0);
		});
	}
}
