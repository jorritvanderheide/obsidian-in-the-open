// A question with a line of text for its answer. Dismissing it is null.
import { Modal, Setting, type App } from 'obsidian';

export interface Question {
	title: string;
	/** What the answer is for, under the title, when it needs saying. */
	description?: string;
	placeholder: string;
	/** The button that takes the answer. */
	cta: string;
	/** Whether no answer is an answer too: then it's the empty string. */
	optional?: boolean;
}

class Ask extends Modal {
	private answer = '';
	private answered = false;

	constructor(
		app: App,
		private readonly question: Question,
		private readonly done: (answer: string | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.question.title);
		if (this.question.description !== undefined) this.contentEl.createEl('p', { text: this.question.description });
		const submit = () => {
			if (this.answer.trim() === '' && this.question.optional !== true) return;
			this.answered = true;
			this.done(this.answer.trim());
			this.close();
		};
		new Setting(this.contentEl).setClass('in-the-open-ask').addText((text) => {
			text.setPlaceholder(this.question.placeholder).onChange((value) => (this.answer = value));
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') submit();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => button.setButtonText(this.question.cta).setCta().onClick(submit));
	}

	onClose(): void {
		if (!this.answered) this.done(null);
	}
}

export function ask(app: App, question: Question): Promise<string | null> {
	return new Promise((resolve) => new Ask(app, question, resolve).open());
}
