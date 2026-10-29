# Compatibility

In the Open's settings live in other people's vaults, people bind hotkeys to its
commands, Due Credit and Paper Trail write the citations it reads, and other
people's sites take its posts. This page says what a release may and may not
change, so all of that keeps working across updates. Changes are listed in
[CHANGELOG.md](../CHANGELOG.md).

In the Open's version is `MAJOR.MINOR.PATCH`. A minor or patch release breaks
nothing below. A major release may, and the changelog then says what changed
and what to do.

This page holds from the first release, 1.0.0. The betas before it promised
nothing.

## Your site

- **What is sent** is the Micropub post and the references extension in
  [Micropub](micropub.md). Sending a property differently, or no longer
  sending one, is breaking for every site that reads it. Sending a new one
  isn't: a site ignores what it doesn't know.
- **The references extension's version** is read from the site's
  configuration. A new version of the extension is sent only to a site that
  says it takes it.
- **Drafts** go only to a site whose configuration lists `draft` under
  `post-status`, since any other would publish one at once.

## Your notes

- **What's read from a note:** the title (its leading H1, then the `title`
  property, then the file name), the `summary`, `categories` and `slug`
  properties, `published-url` and `post-status`, every citation form in Due
  Credit's [Citations](https://github.com/jorritvanderheide/obsidian-due-credit/blob/main/docs/citations.md#what-becomes-a-citation),
  and the **Citation key property** of the notes it links to. No longer
  reading one of these, or reading it differently, is breaking. Reading
  something new isn't.
- **What's written in a note:** only `published-url`, after the first publish,
  and removed when its draft is discarded, and `post-status`: `unpublished`,
  `draft`, `published` or `withdrawn`. A note with either is a post, and its
  title bar says where it stands; one with an address and no status is
  published. They're how the next publish finds the post, and what your own
  searches and Bases may list, so renaming either, or a status, is breaking.
  And `summary`, when a note has none and you type one in before publishing,
  and `categories`, when you set them with **Set categories**.
- **The template:** `Post.md` in the **Template folder**, seeded when it's
  missing and never overwritten. `{{title}}` in it becomes the post's title;
  a new placeholder isn't breaking, and dropping one is.
- **What stays behind:** `%%comments%%`, `<!-- comments -->` and every property
  not listed above never leave. Letting more of a note out is breaking,
  because people write things there for themselves.

## Commands

- **The plugin ID** `in-the-open` never changes. It's the plugin's folder, where
  `data.json` lives, and the start of every command ID.
- **Command IDs** are `in-the-open:new-post`, `in-the-open:publish`,
  `in-the-open:draft`, `in-the-open:withdraw`, `in-the-open:restore` and
  `in-the-open:set-categories`. People bind hotkeys to them, so renaming or
  removing one is breaking. A command's name may change.

## Due Credit and Paper Trail

The citation forms are Due Credit's, which writes them with **Insert
citation**, and In the Open reads them through the same core, as it does the
one form Paper Trail's **Insert annotation** writes. No longer reading one is
breaking for all three plugins.

A new form is read before Paper Trail writes it: the core learns it and is
tagged, Due Credit and In the Open are released on that core, and only then
does Paper Trail write it.

Paper Trail 2.1.0 names a note for a key with a colon or a slash with a dash,
keeping the key in `citekey`. Its citations need In the Open 1.4.0 for a colon
and 1.5.0 for a slash.

## The core

How a note is read, which links cite and how a post is put together are the
core's doing, so the promises on this page hold for the core version a
release bundles. A release that moves to a new one reads the core's
[`CHANGELOG.md`](https://codeberg.org/BW20/obsidian-citation-core/src/branch/main/CHANGELOG.md)
since the last, checks each change against this page, and writes what users
notice under `## Unreleased`.

## Obsidian and pandoc

- **`minAppVersion`** is 1.13.0. Raising it isn't breaking, because
  `versions.json` tells an older Obsidian which release it can still install.
  So every release keeps its line there: `npm version` adds it, and the
  release workflow refuses a tag without one.
- **Desktop only** (`isDesktopOnly`), because publishing runs pandoc, and the
  built-in one runs through Node's WASI.
- **Pandoc:** the README says which version In the Open is tested with, the one
  CI pins, which is the built-in pandoc's too. Needing a newer pandoc for
  something that already worked is breaking. An installed pandoc on the PATH,
  or the one the setting names, keeps coming first: running the built-in one
  instead, when one is installed, is breaking. So is moving the built-in
  pandoc's file, `pandoc-3.13.wasm` in the cache folder Due Credit shares,
  since it would be downloaded again.

## Not covered

These can change in any release:

- How a post's text is written, as long as it reads the same: Markdown has
  more than one way to say a thing.
- The wording of commands, notices and the settings tab.
- The code in `src/`.
