// A post in its note's title bar: a pill saying where it stands, and the next
// step as a button. An unpublished post offers to go up as a draft, and a
// draft to be published; a published post has no step left, so its pill is
// all there is. Clicking the pill opens what else can be done with it.
//
// Wiring only: where a post stands is core/status.ts's to say.
import { MarkdownView, Menu, setIcon, type App, type TFile } from 'obsidian';
import { POST_PROPERTY, statusOf, type PostStatus } from '../core/status';

const PILL = 'in-the-open-status';
const STEP = 'in-the-open-step';

/** What the title bar can set off, each on the file in the view when it's clicked. */
export interface Actions {
	publish(file: TFile, draft: boolean): void;
	withdraw(file: TFile, back: boolean): void;
	/** Whether the file is being sent now: its step is hidden until it's done. */
	busy(file: TFile): boolean;
}

const PILLS: Record<Exclude<PostStatus, 'unpublished'>, { word: string; icon: string; tip: string }> = {
	draft: { word: 'Draft', icon: 'eye-off', tip: 'A draft: only its address leads to it' },
	published: { word: 'Published', icon: 'globe', tip: 'Published on your site' },
	withdrawn: { word: 'Withdrawn', icon: 'archive', tip: "Withdrawn: off your site's lists, at the same address" },
};

/**
 * Obsidian has no way to put an action on every markdown view, so this walks
 * the open ones. Whether a view has its buttons is asked of the DOM: switching
 * between editing and reading rebuilds a view's actions, and throws these away
 * with them.
 */
export function decorate(app: App, actions: Actions): void {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (!(leaf.view instanceof MarkdownView)) continue;
		try {
			decorateOne(app, actions, leaf.view);
		} catch (error) {
			console.error('in-the-open: title bar', leaf.view.file?.path, error);
		}
	}
}

/** Take the buttons back out, so unloading the plugin leaves no trace. */
export function undecorate(app: App): void {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (!(leaf.view instanceof MarkdownView)) continue;
		for (const marker of [PILL, STEP]) leaf.view.containerEl.querySelector(`.${marker}`)?.remove();
	}
}

function decorateOne(app: App, actions: Actions, view: MarkdownView): void {
	// Each handler reads the view when it runs: a view outlives the notes shown
	// in it, and a button made for one would otherwise act on it for good.
	const current = (): { file: TFile; status: PostStatus } | null => {
		const file = view.file;
		const status = file ? statusOf(app.metadataCache.getFileCache(file)?.frontmatter) : null;
		return file && status ? { file, status } : null;
	};
	const now = current();

	// Made right to left: addAction puts each new action first, so the pill,
	// made last, is leftmost, and reads before the step.
	const step = ensure(view, STEP, 'send', 'Publish', () => {
		const note = current();
		if (note?.status === 'unpublished') actions.publish(note.file, true);
		else if (note?.status === 'draft') actions.publish(note.file, false);
	});
	const next = now === null || actions.busy(now.file) ? null : now.status === 'unpublished' ? 'draft' : now.status === 'draft' ? 'publish' : null;
	if (next !== null) {
		step.empty();
		setIcon(step, next === 'draft' ? 'file-up' : 'send');
		step.setAttribute('aria-label', next === 'draft' ? 'Publish as a draft' : 'Publish');
	}
	step.toggle(next !== null);

	const pill = ensure(view, PILL, 'globe', 'Post', (event) => {
		const note = current();
		if (note) menu(app, actions, note.file, note.status).showAtMouseEvent(event);
	});
	const shown = now === null || now.status === 'unpublished' ? null : PILLS[now.status];
	if (shown !== null) {
		pill.empty();
		setIcon(pill.createSpan({ cls: 'in-the-open-status-icon' }), shown.icon);
		pill.createSpan({ text: shown.word });
		pill.setAttribute('aria-label', shown.tip);
	}
	pill.toggle(shown !== null);
}

/** What else can be done with the post, by where it stands. */
function menu(app: App, actions: Actions, file: TFile, status: PostStatus): Menu {
	const menu = new Menu();
	const url: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[POST_PROPERTY];
	const item = (title: string, icon: string, run: () => void) => menu.addItem((each) => each.setTitle(title).setIcon(icon).onClick(run));
	const open = (title: string) => {
		if (typeof url === 'string') item(title, 'external-link', () => window.open(url));
	};
	if (status === 'draft') {
		item('Update the draft', 'file-up', () => actions.publish(file, true));
		open('Open the draft');
		item('Discard the draft', 'trash-2', () => actions.withdraw(file, false));
	} else if (status === 'published') {
		item('Update', 'send', () => actions.publish(file, false));
		open('Open the post');
		item('Withdraw', 'archive', () => actions.withdraw(file, false));
	} else if (status === 'withdrawn') {
		item('Restore', 'archive-restore', () => actions.withdraw(file, true));
		open('Open the post');
	}
	return menu;
}

/** The action, made if this view hasn't got one yet. */
function ensure(view: MarkdownView, marker: string, icon: string, title: string, run: (event: MouseEvent) => void): HTMLElement {
	const existing = view.containerEl.querySelector<HTMLElement>(`.${marker}`);
	if (existing) return existing;
	const button = view.addAction(icon, title, run);
	button.addClass(marker);
	return button;
}
