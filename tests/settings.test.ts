import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_VERSION } from '../src/core/settings';

describe('loadSettings', () => {
	it('starts from the defaults', () => {
		expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
	});

	it('trims, drops the site\'s trailing slash, and drops keys it doesn\'t know', () => {
		const settings = loadSettings({ site: ' https://bw20.nl/ ', token: ' blog ', pandocPath: '', csl: ' apa ', old: 1, version: 0 });
		expect(settings).toEqual({ ...DEFAULT_SETTINGS, version: SETTINGS_VERSION, site: 'https://bw20.nl', token: 'blog', csl: 'apa' });
	});

	it('reads a value of the wrong type as its default', () => {
		expect(loadSettings({ site: 3, bibliography: false })).toEqual(DEFAULT_SETTINGS);
	});
});
