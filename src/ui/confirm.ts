// A question with two answers. Dismissing it is the cautious one.
import { Modal, Setting, type App } from 'obsidian';

class Confirm extends Modal {
	private answered = false;

	constructor(
		app: App,
		private readonly title: string,
		private readonly body: (el: HTMLElement) => void,
		private readonly cta: string,
		private readonly done: (yes: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.title);
		this.body(this.contentEl);
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(this.cta)
					.setCta()
					.onClick(() => {
						this.answered = true;
						this.done(true);
						this.close();
					}),
			);
	}

	onClose(): void {
		if (!this.answered) this.done(false);
	}
}

export function confirm(app: App, title: string, body: (el: HTMLElement) => void, cta: string): Promise<boolean> {
	return new Promise((resolve) => new Confirm(app, title, body, cta, resolve).open());
}

// A question with two answers besides not going on: the first, or the
// second, which is the call to action. Dismissing it is not going on (null).
class Choose extends Modal {
	private answered = false;

	constructor(
		app: App,
		private readonly title: string,
		private readonly body: (el: HTMLElement) => void,
		private readonly answers: [string, string],
		private readonly done: (answer: 0 | 1 | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.title);
		this.body(this.contentEl);
		const answer = (which: 0 | 1) => () => {
			this.answered = true;
			this.done(which);
			this.close();
		};
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => button.setButtonText(this.answers[0]).onClick(answer(0)))
			.addButton((button) => button.setButtonText(this.answers[1]).setCta().onClick(answer(1)));
	}

	onClose(): void {
		if (!this.answered) this.done(null);
	}
}

export function choose(app: App, title: string, body: (el: HTMLElement) => void, answers: [string, string]): Promise<0 | 1 | null> {
	return new Promise((resolve) => new Choose(app, title, body, answers, resolve).open());
}
