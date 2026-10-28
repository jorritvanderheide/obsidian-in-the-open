// A question with a line of text for its answer. Dismissing it is null.
import { Modal, Setting, type App } from 'obsidian';

class Ask extends Modal {
	private answer = '';
	private answered = false;

	constructor(
		app: App,
		private readonly title: string,
		private readonly placeholder: string,
		private readonly done: (answer: string | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.title);
		const submit = () => {
			if (this.answer.trim() === '') return;
			this.answered = true;
			this.done(this.answer.trim());
			this.close();
		};
		new Setting(this.contentEl).addText((text) => {
			text.setPlaceholder(this.placeholder).onChange((value) => (this.answer = value));
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') submit();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => button.setButtonText('Create').setCta().onClick(submit));
	}

	onClose(): void {
		if (!this.answered) this.done(null);
	}
}

export function ask(app: App, title: string, placeholder: string): Promise<string | null> {
	return new Promise((resolve) => new Ask(app, title, placeholder, resolve).open());
}
