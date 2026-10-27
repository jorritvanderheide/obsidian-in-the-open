// What a command needs from the plugin, and nothing else. Narrow on purpose, so
// a command cannot reach the whole plugin and does not depend on `main.ts`.
import type { App } from 'obsidian';
import type { Settings } from './core/settings';

export interface Context {
	app: App;
	settings: Settings;
	saveSettings(): Promise<void>;
}
