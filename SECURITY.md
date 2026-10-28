# Security policy

## Supported versions

Security fixes go into the latest release of In the Open. Older releases don't
get separate fixes, so please update before you report.

## Reporting a problem

Please don't open a public issue for a security problem. Report it privately
through GitHub instead:

https://github.com/jorritvanderheide/obsidian-in-the-open/security/advisories/new

Include your versions of In the Open, Obsidian and pandoc, your operating
system, what runs your site's Micropub endpoint, and the steps to reproduce it.
Reports are looked at before anything about them is made public.

## What counts

In the Open sends the note you publish to the site you set, with your token. It
reads that note, your bibliography and your citation style, and writes only
the post's address and status into that note, besides the notes and the
template **New post** makes. See
[section 11 of the README](README.md#11-network-and-file-disclosure). These
are security problems:

- Sending anything the README doesn't list, or sending to anywhere but your
  site.
- Your token leaving Obsidian's secret storage for anywhere but your site's
  Micropub and media endpoints: into `data.json`, a log, a notice, or another
  site a request is redirected to.
- Writing anywhere in your vault but the `published-url` and `post-status`
  properties of the note you publish, withdraw, restore or discard, its
  `summary` when you type one in, a note
  **New post** makes, and `Post.md` in the template folder when it isn't
  there.
- The text of a note changing what pandoc reads, writes or runs, or making
  In the Open run anything but pandoc.
- Something you wrote for yourself, like a comment, reaching your site.

Problems in your site's Micropub endpoint belong to whoever makes it, and
problems in pandoc itself to [pandoc](https://github.com/jgm/pandoc).

A bug that publishes the wrong text, or leaves something out, is serious too,
but it isn't secret: please report that as a normal issue, so others can see
it.
