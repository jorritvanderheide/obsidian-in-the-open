// The new posts In the Open sent without hearing back: kept on this device
// until the note has the post's address. If the plugin stopped, the connection
// dropped or the address couldn't be written, the post may be on the site
// already, and the next publish asks before it makes a second one. Pure, so
// it's tested with plain objects.

/** When each note's new post was sent, by the note's path. */
export type Sending = Record<string, string>;

/** What was saved, keeping only paths with a time. */
export function readSending(data: unknown): Sending {
	if (data === null || typeof data !== 'object' || Array.isArray(data)) return {};
	return Object.fromEntries(Object.entries(data as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/** With the note at `path` sent at `at`. */
export function sent(sending: Sending, path: string, at: Date): Sending {
	return { ...sending, [path]: at.toISOString() };
}

/** Without the note at `path`. */
export function forgotten(sending: Sending, path: string): Sending {
	return Object.fromEntries(Object.entries(sending).filter(([each]) => each !== path));
}

/** With the note that was at `from` now at `to`. */
export function moved(sending: Sending, from: string, to: string): Sending {
	const at = sending[from];
	return at === undefined ? sending : { ...forgotten(sending, from), [to]: at };
}
