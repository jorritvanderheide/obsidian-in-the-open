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

## Releasing

1. **Write the notes.** Rename `## Unreleased` in `CHANGELOG.md` to the new
   version.
2. **Bump the version:** `npm version <x.y.z> --no-git-tag-version` updates
   `manifest.json` and `versions.json`, and leaves the commit and the tag to
   jj. A version like `1.2.0-beta.1` becomes a pre-release, for beta testers.
   The version in `package-lock.json` changes `npmDepsHash`, so run
   `nix flake check` and put the hash it gives in `flake.nix`.
3. **Push** the commit, then tag it, named for the version without a `v`:
   `jj tag set <x.y.z> -r <commit>`, and `git push codeberg <x.y.z>`, since jj
   doesn't push tags. Codeberg is the only remote: GitHub mirrors it. The
   core's commit that `flake.lock` pins has to be on Codeberg first, since CI
   clones it from there.
4. When the tag reaches GitHub, `.github/workflows/release.yml` runs the CI
   checks, makes sure the tag is the version in `manifest.json`,
   `package.json` and `versions.json`, builds it, attests `main.js` and
   `styles.css`, and creates a **draft** GitHub release named like "In the
   Open 1.0.0", with the version's part of `CHANGELOG.md` as its notes.
5. **Publish the draft.** Obsidian's community directory installs from GitHub
   releases, and a tag alone is not one. The first release is also submitted
   to the directory, in obsidianmd/obsidian-releases.
