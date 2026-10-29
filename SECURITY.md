# Security policy

## Supported versions

Security fixes go into the latest release of In the Open. Older releases don't
get separate fixes, so please update before you report.

## Reporting a problem

Please don't open a public issue for a security problem. Report it privately
through GitHub instead:

https://github.com/jorritvanderheide/obsidian-in-the-open/security/advisories/new

Include your versions of In the Open, Obsidian and pandoc (or that it's
the built-in one), your operating system, the software your site takes posts
with (its Micropub endpoint), and the steps to reproduce it. I'll look into
your report before anything about it is made public.

## What counts

In the Open sends the note you publish to the site you set, with your token. It
reads that note and the citation keys and posts of the notes it links to, your
bibliography, your citation style, whether strict line breaks are on in your
vault's settings, and the folders on your PATH, to find pandoc. The first time
a note is public, it reads which of your notes link to it. It reads the post
status of the notes you have open, for their title bar, and the settings tab
reads the path and properties of every note. For each publish, it writes the
files pandoc needs to a temporary folder and removes them afterwards, and until
it hears back about a new post, it keeps the note's path and the time in
Obsidian's local storage on this device. Into the note you publish it writes
only the post's address and status, a summary you type in, and categories you
set. **New post** also makes a note, and the template it starts from, in a
template folder it makes if there's none. Once, if you agree, In the Open
downloads the built-in pandoc from pandoc's release on GitHub into your cache
folder, outside the vault.
[Section 11 of the README](README.md#11-network-and-file-disclosure) has the
full list. These are security problems:

- Sending anything the README doesn't list, or sending to anywhere but your
  site, except the one request for the built-in pandoc to pandoc's release.
- Your token leaving Obsidian's keychain for anywhere but your site's
  Micropub and media endpoints, the addresses it takes posts and images at.
  That includes `data.json`, a log, a notice, or another site a request is
  redirected to.
- Writing anywhere in your vault but the `published-url` and `post-status`
  properties of the note you publish, withdraw, restore or discard, its
  `summary` when you type one in, its `categories` when you set them, a
  note **New post** makes, and `Post.md` in the template folder when it isn't
  there.
- The text of a note changing what pandoc reads, writes or runs, or making
  In the Open run anything but pandoc.
- The built-in pandoc being kept or run without matching the hash In the Open
  ships with, the fingerprint of pandoc's release file. Or the built-in pandoc
  seeing more of your disk than the vault, the folders of the files it needs,
  and its temporary folders.
- Something you wrote for yourself, like a comment, reaching your site.

Problems in your site's Micropub endpoint belong to whoever makes it, and
problems in pandoc itself to [pandoc](https://github.com/jgm/pandoc).

A bug that publishes the wrong text, or leaves something out, is serious too,
but it isn't secret. Please report it as a normal issue, so others can see it.
