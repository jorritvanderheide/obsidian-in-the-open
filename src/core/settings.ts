// Settings are addresses, not opinions: which site, which token, where pandoc
// is, which bibliography and which style. How a note becomes a post is the
// product and stays in code.

/**
 * Stamped on every save, and bumped when a saved key is renamed or its meaning
 * changes. Here from the start because it is the one thing that cannot be added
 * afterwards: by then the data is already on disk unlabelled.
 */
export const SETTINGS_VERSION = 1;

export interface Settings {
	version: number;
	/** The site's address, https://, where its Micropub endpoint is found. Empty until you set it. */
	site: string;
	/**
	 * The name of the secret in Obsidian's keychain that holds the site's
	 * token. The token itself is never in the settings, which a synced or
	 * committed vault takes along.
	 */
	token: string;
	/** The pandoc executable: a name found on the PATH, or a full path. The default, `pandoc`, falls back to the built-in one when there's none (the core's `choosePandoc`). */
	pandocPath: string;
	/**
	 * The `.bib` file that decides which wikilinks are citations, kept current
	 * by Better BibTeX's auto-export: a path relative to the vault, or an
	 * absolute one or one starting with `~` outside it. Empty publishes
	 * without citations.
	 */
	bibliography: string;
	/** The folder in the vault that holds one note per paper, for the check before publishing. */
	literatureFolder: string;
	/** The frontmatter property holding a paper note's citation key, as Paper Trail writes it. */
	keyProperty: string;
	/**
	 * Citation style: the name of one Zotero has installed (`apa`), or a path to
	 * a `.csl` file. Empty is pandoc's built-in Chicago author-date.
	 */
	csl: string;
	/** Where the post template, `Post.md`, is kept, and seeded to when it is missing. */
	templateFolder: string;
}

export const DEFAULT_SETTINGS: Settings = {
	version: SETTINGS_VERSION,
	site: '',
	token: '',
	pandocPath: 'pandoc',
	bibliography: 'Literature/library.bib',
	literatureFolder: 'Literature',
	keyProperty: 'citekey',
	csl: '',
	templateFolder: 'Templates/In the Open',
};

function text(value: unknown): string | undefined {
	return typeof value === 'string' ? value.trim() : undefined;
}

/**
 * Settings from whatever was saved, built fresh from the names known here so a
 * key nothing reads any more is dropped.
 *
 * Trimmed, because a stray space in a path is a silent miss. A blanked address
 * falls back to its default rather than pointing at nothing, except where
 * empty is an answer: no site or token yet, no bibliography, and the built-in
 * style. The site loses a slash at its end, so a post's address is the site's
 * and its path.
 */
export function loadSettings(data: unknown): Settings {
	const saved = (data ?? {}) as Record<string, unknown>;
	const address = (key: 'pandocPath' | 'literatureFolder' | 'keyProperty' | 'templateFolder') => text(saved[key]) || DEFAULT_SETTINGS[key];
	const optional = (key: 'site' | 'token' | 'bibliography' | 'csl') => text(saved[key]) ?? DEFAULT_SETTINGS[key];

	return {
		version: SETTINGS_VERSION,
		site: optional('site').replace(/\/+$/, ''),
		token: optional('token'),
		pandocPath: address('pandocPath'),
		bibliography: optional('bibliography'),
		literatureFolder: address('literatureFolder'),
		keyProperty: address('keyProperty'),
		csl: optional('csl'),
		templateFolder: address('templateFolder'),
	};
}
