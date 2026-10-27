# Development

## Setup

In the Open's core is a library of its own,
[obsidian-citation-core](https://codeberg.org/BW20/obsidian-citation-core),
which npm takes from the folder next to this one. Check it out there first:

```sh
git clone https://codeberg.org/BW20/obsidian-citation-core ../obsidian-citation-core
nix develop     # or any Node.js 20+
npm install
npm run dev     # rebuild on change
```

A change in the core shows up in the next build here, with nothing to link or
publish. Its own checks, and what to run before a change there is done, are in
its README.

To try it in a vault, copy or link `main.js` and `manifest.json` into
`<vault>/.obsidian/plugins/in-the-open/` and reload Obsidian, or turn the plugin
off and on again.

## Checks

```sh
npm test        # vitest
npm run lint    # eslint, with the Obsidian plugin's rules
npm run build   # type check and production build
```

CI runs all three, on Node 24, for every push to `main` and every pull
request, and again before every release (`.github/workflows/ci.yml`). It also
runs `nix flake check`, which builds the plugin with Nix and runs the core's
checks: after a change to `package-lock.json`, update `npmDepsHash` in
`flake.nix`, as its comment says.

## The core's version

npm builds against whatever is checked out next to this folder. A release is
built against the commit `flake.lock` pins: CI checks that commit out before
`npm ci`, and Nix copies it next to the source before building. To move to a
newer core:

```sh
nix flake update citation-core
```

Then build and test here, with the core checked out at the same commit.

## Releases

A tag that is the version in `manifest.json` builds a draft GitHub release,
after the CI checks, with `main.js` attested and the version's part of
`CHANGELOG.md` as its notes (`.github/workflows/release.yml`).
`npm version <version>` sets the version in `manifest.json` and adds its line
to `versions.json`, which the release workflow checks.
