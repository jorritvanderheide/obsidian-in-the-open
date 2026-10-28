import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, PublishError, type Response } from '../src/core/micropub';
import { send } from '../src/http';
import { call, type Site } from '../src/site';

// The wire, answered by each test: what `call` makes of the site's answer.
vi.mock('../src/http', () => ({ send: vi.fn(), page: vi.fn() }));
const answer = (status: number, body = '', headers: Record<string, string> = {}): Response => ({ status, headers, body });
const site: Site = { home: 'https://bw20.nl', endpoint: 'https://bw20.nl/micropub', token: 'secret', config: { mediaEndpoint: null, references: 1, drafts: true } };
const update = () => call(site, site.endpoint, { method: 'POST', type: 'application/json', body: '{}' });

describe('call', () => {
	beforeEach(() => vi.mocked(send).mockReset());

	it('sends the token, and gives back the answer', async () => {
		vi.mocked(send).mockResolvedValue(answer(204));
		expect((await update()).status).toBe(204);
		expect(vi.mocked(send).mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer secret', 'Content-Type': 'application/json' });
	});

	it('makes a post changed on the site a ConflictError, with what the site said', async () => {
		vi.mocked(send).mockResolvedValue(answer(409, '{"error": "conflict", "error_description": "log/nixos-module-system was edited elsewhere since it was last published (commit 3f2a1b9)"}'));
		const error = await update().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ConflictError);
		expect((error as Error).message).toBe('log/nixos-module-system was edited elsewhere since it was last published (commit 3f2a1b9)');
	});

	it('refuses a redirect rather than following it with the token', async () => {
		vi.mocked(send).mockResolvedValue(answer(302, '', { location: 'https://elsewhere.example/' }));
		await expect(update()).rejects.toThrow("bw20.nl answered with a redirect, which In the Open doesn't follow with your token.");
		expect(vi.mocked(send)).toHaveBeenCalledTimes(1);
	});

	it("says when the site doesn't take the token, and what it said otherwise", async () => {
		vi.mocked(send).mockResolvedValue(answer(401));
		await expect(update()).rejects.toThrow("bw20.nl doesn't take your token.");
		vi.mocked(send).mockResolvedValue(answer(400, '{"error": "invalid_request", "error_description": "missing summary"}'));
		const error = await update().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(PublishError);
		expect(error).not.toBeInstanceOf(ConflictError);
		expect((error as Error).message).toBe('bw20.nl refused it: missing summary');
	});
});
