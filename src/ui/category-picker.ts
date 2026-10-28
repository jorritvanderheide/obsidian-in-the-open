// The categories a post can be in, as switches, on for the ones it has.
// Dismissing it is null: nothing changes.
import { Modal, Setting, type App } from 'obsidian';
import type { CategoryChoice } from '../core/micropub';

class CategoryPicker extends Modal {
	private answered = false;

	constructor(
		app: App,
		private readonly name: string,
		private readonly choices: CategoryChoice[],
		private readonly done: (chosen: string[] | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Categories of ${this.name}`);
		this.contentEl.createEl('p', { text: 'The categories your site has. Switch on the ones this post is in.' });
		const chosen = new Set(this.choices.filter((choice) => choice.chosen).map((choice) => choice.name));
		for (const choice of this.choices) {
			const setting = new Setting(this.contentEl).setName(choice.name).addToggle((toggle) =>
				toggle.setValue(choice.chosen).onChange((on) => {
					if (on) chosen.add(choice.name);
					else chosen.delete(choice.name);
				}),
			);
			if (!choice.onSite) setting.setDesc("Not on your site, which would refuse the post. Switch it off, or add it to your site.");
		}
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText('Save')
					.setCta()
					.onClick(() => {
						this.answered = true;
						// In the order they're listed: the site's, then the rest.
						this.done(this.choices.map((choice) => choice.name).filter((name) => chosen.has(name)));
						this.close();
					}),
			);
	}

	onClose(): void {
		if (!this.answered) this.done(null);
	}
}

/** The categories chosen, or null when the picker was dismissed. */
export function pickCategories(app: App, name: string, choices: CategoryChoice[]): Promise<string[] | null> {
	return new Promise((resolve) => new CategoryPicker(app, name, choices, resolve).open());
}
