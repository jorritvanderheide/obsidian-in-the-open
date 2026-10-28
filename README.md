# In the Open

**Publish a note to your website over Micropub, with its links turned into real citations.**

Works well with [Paper Trail](https://community.obsidian.md/plugins/paper-trail)
and [Due Credit](https://community.obsidian.md/plugins/due-credit). See
[Works well with](#10-works-well-with).

> [!NOTE]
> In the Open isn't released yet. This README describes what the first release
> will do, and fills in as it's built.

<br/>

![Obsidian Compatibility](https://img.shields.io/badge/Obsidian-v1.13.0+-483699?logo=obsidian&style=flat-square)
![Desktop only](https://img.shields.io/badge/platform-desktop-483699?style=flat-square)
[![Checks](https://github.com/jorritvanderheide/obsidian-in-the-open/actions/workflows/ci.yml/badge.svg)](https://github.com/jorritvanderheide/obsidian-in-the-open/actions/workflows/ci.yml)
[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue?style=flat-square)](LICENSE)

<!-- SCREENSHOT images/hero.png: a note with citation links in Obsidian, next to the same post on a website, with its citations and reference list -->

You write in Obsidian, and your citations are links: `[[marsh2024]]` opens the
paper, and the paper's backlinks show everywhere you cited it. But a blog post
needs more than a copy of the note. It needs real citations and a reference
list, your links to other posts pointing at those posts, and none of the
comments you left for yourself.

In the Open sends the note you have open to your website, ready to read. It
formats your citations in the style you choose, sends the reference list along
with the post, and leaves out everything that only makes sense in Obsidian. It
speaks [Micropub](https://www.w3.org/TR/micropub/), the open standard for
posting to a website, so it works with any site that does.

<br/>

## 1 Installation

1. **Install pandoc** from [pandoc.org](https://pandoc.org/installing.html).
   In the Open is tested with pandoc 3.7.
2. **For citations, export a `.bib` file from Zotero** with
   [Better BibTeX](https://retorque.re/zotero-better-bibtex/)'s auto-export
   turned on, so it stays up to date as you add papers. Pin your citation
   keys in Better BibTeX: a published post cites a key for good.
3. **Have a site that takes Micropub.** To have your references show as a
   reference list, it also needs the references extension; see
   [Your site](#62-what-your-site-gets).
4. **Install In the Open** in Obsidian: go to Settings → Community plugins →
   Browse, search for "In the Open", then install and enable it. You can also
   open [its page in the plugin directory](https://community.obsidian.md/plugins/in-the-open).

In the Open needs Obsidian 1.13 or later, on desktop.

<br/>

## 2 Getting started

1. **Connect your site.** In Settings → In the Open, set **Site** to your
   site's address, and **Token** to the token your site gave you.
2. **Point In the Open at your bibliography.** Set **Bibliography** to your
   `.bib` file. The default is `Literature/library.bib` in your vault.
3. **Give the note a summary.** Add a `summary` property: one sentence about
   the post.
4. **Publish it.** Run **Publish note**, or right-click the note and choose it
   from the menu. In the Open sends it, writes the post's address to the
   note's `published-url` property, and tells you when the post is live.
   Publishing the note again updates the post. To see it on your site
   first, run **Publish note as a draft**.

<br/>

## 3 Safety and quality

In the Open sends one note, and only to the site you set. What you wrote for
yourself never leaves: comments are stripped, and only the title, summary,
categories and slug go along from the note's properties. The only thing it
writes in your vault is the post's address, in the note you published.
[Section 11](#11-network-and-file-disclosure) lists exactly what it reads,
sends and writes.

Your token is kept in Obsidian's secret storage, not in the plugin's settings
file, so it doesn't travel with a vault you sync or commit.

Every push is tested, and every release is built in the open with a signed
attestation, so you can check that the file you installed is the one that was
built. [Section 11.6](#116-how-releases-are-built) says how.

<br/>

## Table of contents

- [4 Documentation](#4-documentation)
- [5 Features](#5-features)
- [6 How it works](#6-how-it-works)
- [7 Citations](#7-citations)
- [8 Commands](#8-commands)
- [9 Settings](#9-settings)
- [10 Works well with](#10-works-well-with)
- [11 Network and file disclosure](#11-network-and-file-disclosure)
- [12 Questions or issues?](#12-questions-or-issues)
- [13 Support](#13-support)
- [14 License](#14-license)

<br/>

## 4 Documentation

If you want to work on the plugin, or make your site take its posts:

- [**Architecture**](docs/architecture.md) - How the code is layered, and
  what it shares with Due Credit.
- [**Micropub**](docs/micropub.md) - What In the Open sends, and what your
  site has to do to take it, the references extension included.
- [**Pipeline**](https://codeberg.org/BW20/obsidian-citation-core/src/branch/main/docs/pipeline.md) - Every step from a note to pandoc's input,
  in order.
- [**Development**](docs/development.md) - Setup, tests and releases.
- [**Compatibility**](docs/compatibility.md) - What a release may and may not
  change, so your settings, hotkeys, notes and site keep working.

<br/>

## 5 Features

### 5.1 Publishing

- **One command** - Publish the note you have open, or any note from its
  right-click menu.
- **Updates in place** - Publishing a note again updates its post, at the
  same address.
- **Drafts first** - See a post on your site before anyone else does: a
  draft is at its address, but in none of your site's lists or its feed,
  until you publish it. On a site that takes drafts.
- **Knows when it's live** - On a site that builds before it shows a post,
  In the Open waits and tells you when it's up, or that it isn't yet.
- **Withdraw, and bring back** - Take a post off your site's lists without
  breaking the links to it, and restore it later.
- **Images included** - Images in the note are uploaded with it. Every image
  needs alt text, so every reader gets it.
- **Works with any Micropub site** - A site that knows nothing of citations
  still gets a finished post, as HTML, with its reference list.

### 5.2 Citations

- **Links become citations** - `[[marsh2024]]` becomes "(Marsh 2024)", linked
  to its entry in the reference list.
- **References travel with the post** - Each work goes to your site formatted
  once, in your citation style, with its DOI.
- **The same forms as Due Credit** - A note reads the same on your site as in
  a Word export.

### 5.3 Private stays private

- **Comments stay behind** - `%%…%%` and `<!-- … -->` never leave the vault.
- **Only the properties that matter** - Tags and the rest of your properties
  stay in Obsidian.
- **No Obsidian leftovers** - Block IDs, tags, embedded notes and plugin blocks
  are left out.

<br/>

## 6 How it works

### 6.1 What happens to your note

Before anything is sent, In the Open removes or rewrites everything that only
makes sense inside Obsidian:

| In your note | On your site |
| --- | --- |
| `%%comment%%`, `<!-- comment -->` | Left out. They're for you. |
| `^abc123` block IDs | Left out. |
| An H1 on the first line | The post's title. Without one, the `title` property, then the file name. |
| Properties | Only `summary`, `categories` and `slug` go along. |
| `![[figure.png\|alt text]]` | The image, uploaded to your site, with its alt text. |
| An embedded note, PDF or canvas | Left out. |
| `dataview`, `dataviewjs`, `tasks`, `query` and `base` blocks | Left out. Published, they'd only be their query. |
| A line of `#tags` | Left out. A tag in a sentence stays as its word. |
| A link to a note you've published | A link to its post. |
| A link to a note you haven't published | Its words, as Obsidian shows them. In the Open lists these links before it sends, so you can publish anyway, or publish those notes first. |
| `> [!note] Title` | A quote with the title in bold. |
| `==highlight==` | Plain text: a site has no highlight of its own. |
| `[^1]` and `^[inline]` footnotes | Footnotes. |
| Your headings | A level down, under the post's title, which the site shows as the page's heading. |

### 6.2 What your site gets

A Micropub post: the title, the summary, the text, the categories and the
slug. With the references extension, it gets the text as Markdown, every work
the post cites, formatted, and each citation as a link to its work. Any other
site gets the text as HTML, ready to show, with the citations as plain text
and the reference list at the end.

What a site has to do to take these posts, the extension included, is in
[Micropub](docs/micropub.md).


<br/>

## 7 Citations

In the Open reads citations exactly as Due Credit does, through the same code:
`[[marsh2024]]`, `[[marsh2024|marsh2024, p. 12]]`, pandoc's
`[@marsh2024, p. 12]`, and the rest. Every form is in Due Credit's
[Citations](https://github.com/jorritvanderheide/obsidian-due-credit/blob/main/docs/citations.md).

A link to a paper whose key isn't in your bibliography would go out as its
plain name, so In the Open lists those before it sends, as Due Credit does
before an export: you can publish anyway, or fix the key first.

<br/>

## 8 Commands

None of the commands has a hotkey, so you can choose your own in Settings →
Hotkeys. Each one is also on a note's right-click menu, in the file explorer or
on its tab.

- `In the Open: Publish note` - Sends the note to your site, or updates its post
  if it's published already. A draft is published, dated today.
- `In the Open: Publish note as a draft` - Sends the note as a draft, or
  updates its draft. Only its address leads to it, until you publish it.
- `In the Open: Withdraw note` - Takes the post off your site's lists. Its
  address keeps working. A draft is discarded instead, and the note forgets
  its address.
- `In the Open: Restore note` - Brings a withdrawn post back.

<br/>

## 9 Settings

**Your site**

| Setting | Default | |
| --- | --- | --- |
| **Site** | None | Your site's address. In the Open finds its Micropub endpoint from there. |
| **Token** | None | The token your site gave you. Kept in Obsidian's secret storage. |

**Pandoc**

| Setting | Default | |
| --- | --- | --- |
| **Pandoc** | `pandoc` | Its name if it's on your PATH, or its full path. |

**Citations**

| Setting | Default | |
| --- | --- | --- |
| **Bibliography** | `Literature/library.bib` | The `.bib` file that decides which links are citations. A path in your vault, or outside it, starting with `/` or `~`. |
| **Papers folder** | `Literature` | Where your paper notes are. |
| **Citation key property** | `citekey` | The property that holds a paper note's citation key. |
| **Citation style** | Chicago author-date | A style Zotero has installed, such as `apa`, or the path to a `.csl` file. |

<br/>

## 10 Works well with

These plugins are by the same author. Each does one thing, and In the Open
doesn't need either of them, but they fit together nicely.

### 10.1 Paper Trail

[Paper Trail](https://community.obsidian.md/plugins/paper-trail) turns your
Zotero library into a reading queue, and writes citations as links. Everything
it writes, In the Open reads, and it gives every paper note the `citekey`
property that keeps your citations working when Better BibTeX changes a key.

### 10.2 Due Credit

[Due Credit](https://community.obsidian.md/plugins/due-credit) exports a note
to Word, PDF or LaTeX. It shares In the Open's way of reading a note, so the
same note reads the same on your site as in the file you send your
supervisor.

<br/>

## 11 Network and file disclosure

In the Open runs on your computer, and connects to one place: the site you set
in **Site**.

### 11.1 What it sends

Only to your site, and only when you run a command:

- **The post:** the note's text after the steps in
  [What happens to your note](#61-what-happens-to-your-note), its title, and
  its `summary`, `categories` and `slug` properties.
- **References:** every work the note cites, from your bibliography.
- **Images:** the images in the note.
- **Whether it's a draft:** with a draft, and when it's published.
- **Questions:** what the site takes, and whether a published note's post is
  a draft.
- **Your token**, with every request, so your site knows it's you.

### 11.2 What it reads

- **Notes:** The note you publish, and the citation keys and `published-url`
  of the notes it links to.
- **Bibliography:** The `.bib` file you set in **Bibliography**.
- **Citation style:** From Zotero's styles folder (`~/Zotero/styles`), or the
  `.csl` file you set.
- **Obsidian's settings:** Whether strict line breaks are on, from the vault's
  `app.json`.

### 11.3 What it writes

- **The post's address:** the `published-url` property, in the note you
  published, and removed from it when you discard its draft. Nothing else in
  your notes, and nothing anywhere else in your vault.
- **Temporary files:** For each publish, pandoc's filters and the note's
  properties go in a temporary folder, which is removed afterwards.

### 11.4 What it stores

- **Settings:** Its own `data.json` in the plugin folder.
- **Your token:** In Obsidian's secret storage, never in `data.json`.

### 11.5 What it runs

- **Pandoc:** The one you set in **Pandoc**. Nothing else.

### 11.6 How releases are built

Every push is built, linted with [ESLint](https://eslint.org/) and the official
[Obsidian ESLint plugin](https://github.com/obsidianmd/eslint-plugin), tested
with [Vitest](https://vitest.dev/), and built with Nix as well. The citation
tests run through a real, pinned version of pandoc, so its output can't drift
unnoticed. Releases are built by GitHub Actions from the tagged source, after
the same checks and a check that the tag is the version in `manifest.json`,
with every action pinned to an exact version, and come with a signed build
provenance attestation, so you can check that the file you installed is the one
that was built:

```sh
gh attestation verify main.js --repo jorritvanderheide/obsidian-in-the-open
```

<br/>

## 12 Questions or issues?

Have a look at the [FAQ](FAQ.md) first. If something still doesn't work, or
you have an idea, please
[open an issue](https://github.com/jorritvanderheide/obsidian-in-the-open/issues/new/choose).
Found a security problem? Please report it privately, as described in the
[security policy](SECURITY.md).

The source lives on [Codeberg](https://codeberg.org/BW20/obsidian-in-the-open)
and is mirrored to [GitHub](https://github.com/jorritvanderheide/obsidian-in-the-open).

<br/>

## 13 Support

In the Open is free. If you find it useful, you can support its development on
Liberapay:

[![Donate](https://liberapay.com/assets/widgets/donate.svg)](https://liberapay.com/BW20)

<br/>

## 14 License

Copyright © 2026 Jorrit van der Heide. Licensed under the [EUPL-1.2](LICENSE).
