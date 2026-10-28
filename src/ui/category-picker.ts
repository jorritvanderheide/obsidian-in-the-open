// The categories a post can be in, as switches, on for the ones it has, and a
// field for a new one. Dismissing it is null: nothing changes.
import { Modal, Setting, type App } from 'obsidian';
import type { CategoryChoice } from '../core/micropub';

class CategoryPicker extends Modal {
	private answered = false;

	constructor(
		app: App,
		private readonly name: string,
		private readonly choices: CategoryChoice[],
		private readonly listed: boolean,
		private readonly done: (chosen: string[] | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Categories of ${this.name}`);
		this.contentEl.createEl('p', {
			text: this.listed
				? 'The categories your site has. Switch on the ones this post is in, or add a new one, which your site makes when you publish.'
				: "Your site doesn't list its categories. These are the note's: switch them off, or add one.",
		});
		const chosen = new Set(this.choices.filter((choice) => choice.chosen).map((choice) => choice.name));
		const list = this.contentEl.createDiv();
		const show = (choice: CategoryChoice) => {
			const setting = new Setting(list).setName(choice.name).addToggle((toggle) =>
				toggle.setValue(chosen.has(choice.name)).onChange((on) => {
					if (on) chosen.add(choice.name);
					else chosen.delete(choice.name);
				}),
			);
			if (!choice.onSite && this.listed) setting.setDesc('New: your site makes it when you publish.');
		};
		this.choices.forEach(show);

		let typed = '';
		const add = () => {
			const name = typed.trim();
			if (name === '' || this.choices.some((choice) => choice.name === name)) return;
			const choice = { name, onSite: false, chosen: true };
			this.choices.push(choice);
			chosen.add(name);
			show(choice);
		};
		new Setting(this.contentEl)
			.setName('New category')
			.addText((text) => {
				text.setPlaceholder('Its name, such as open-science').onChange((value) => (typed = value));
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key !== 'Enter') return;
					add();
					text.setValue('');
					typed = '';
				});
			})
			.addButton((button) =>
				button.setButtonText('Add').onClick(() => {
					add();
				}),
			);

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

/** The categories chosen, or null when the picker was dismissed. `listed` is whether the site gave its own. */
export function pickCategories(app: App, name: string, choices: CategoryChoice[], listed: boolean): Promise<string[] | null> {
	return new Promise((resolve) => new CategoryPicker(app, name, choices, listed, resolve).open());
}
