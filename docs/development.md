# Development

## Setup

In the Open's core is a library of its own,
[obsidian-citation-core](https://codeberg.org/BW20/obsidian-citation-core),
which npm takes from its GitHub mirror, at the commit `package.json` pins, so
a checkout of this repository builds on its own:

```sh
nix develop     # or any Node.js 20+
npm install
npm run dev     # rebuild on change
```

To try a change in the core before it is pushed, with it checked out next to
this folder: `npm install --no-save ../obsidian-citation-core`. `npm ci` goes
back to the pinned one. The core's own checks, and what to run before a change
there is done, are in its README.

To try it in a vault, copy or link `main.js` and `manifest.json` into
`<vault>/.obsidian/plugins/in-the-open/` and reload Obsidian, or turn the plugin
off and on again.

## Checks

```sh
npm test        # vitest
npm run lint    # eslint, with the Obsidian plugin's rules, failing on any warning
npm run build   # type check and production build
```

CI runs all three, on Node 24, for every push to `main` and every pull
request, and again before every release (`.github/workflows/ci.yml`). It also
runs `nix flake check`, which builds the plugin with Nix and runs its tests:
after a change to `package-lock.json`, update `npmDepsHash` in `flake.nix`, as
its comment says.

## The core's version

The core is pinned once, in `package.json`, which npm builds with. A plugin
pins only a tagged core version, and the core's own checks, its filter tests
through a real pandoc among them, pass on a commit before it is tagged, so
they don't run again here. To move to a newer one, once its tag is on Codeberg
and the GitHub mirror:

```sh
rev=$(git ls-remote https://codeberg.org/BW20/obsidian-citation-core.git refs/tags/<x.y.z> | cut -f1)
npm install "git+https://github.com/jorritvanderheide/obsidian-citation-core.git#$rev"
nix run nixpkgs#prefetch-npm-deps -- package-lock.json   # the new npmDepsHash
```

npm writes the dependency as `github:…#<rev>` in `package.json`, and resolves
it to a `git+ssh://` address in `package-lock.json`. A checkout without SSH
keys builds from it all the same, as CI does. Then build and test here, read
the core's `CHANGELOG.md` since the last version, and write what users notice
under `## Unreleased`.

## Tests

Tests are in `tests/`, one per file in `src/core/`, named after it. Two more
cover the network: `http.test.ts` runs `src/http.ts` against a real server on
this computer, and `site.test.ts` runs `src/site.ts` with that mocked. The
core's tests, the filters through a real pandoc among them, are in the core.

### Moving to a newer pandoc

The core's tests expect pandoc 3.13, the built-in pandoc's version, which the
core's flake pins twice: pandoc's static build, and its WebAssembly build. To
move to a newer one, do it in the core, as its README says, and update "tested
with pandoc" in the README here.

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
   core's commit has to be on its GitHub mirror first, since npm takes it
   from there.
4. When the tag reaches GitHub, `.github/workflows/release.yml` runs the CI
   checks, makes sure the tag is the version in `manifest.json`, `package.json`
   and `versions.json`, and builds it without running any dependency's install
   script. It attests `main.js`, `manifest.json` and `styles.css`, and a second
   job, the only one that can write to the repository, puts them in a **draft**
   GitHub release named like "In the Open 1.0.0", with the version's part of
   `CHANGELOG.md` as its notes.
5. **Publish the draft.** Obsidian's community directory installs from GitHub
   releases, and a tag alone is not one. The first release is also submitted
   to the directory, in obsidianmd/obsidian-releases.

## Updating an action

The workflows pin every action to a commit, with the version in a comment, so a
tag that is moved later can't change what builds a release. Nothing updates
them automatically, so look at them before a release. To move one to a newer
version, look up the commit the tag points to and replace both the hash and the
comment:

```sh
gh api repos/actions/checkout/commits/v6.1.0 --jq .sha
```

Both workflows also default to read-only. In the release workflow, the build job
asks only to sign the attestation, and the release job only to write the
release, which runs none of the repository's code.
