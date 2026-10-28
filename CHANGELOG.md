# Changelog

What changed in each release of In the Open, newest first. What counts as
breaking is in [Compatibility](docs/compatibility.md).

## 1.2.0

- Markdown images of files in your vault, like `![A raised bed](bed.png)`,
  are uploaded with the post, as `![[bed.png]]` always was. They used to go
  out with a path no site has.
- If a new post's address never made it into the note, because Obsidian
  closed while it was sending, the connection dropped or the note couldn't
  be written, the next publish of that note asks whether the post is on your
  site already. You can give its address, which In the Open checks, or
  publish it as new. It used to make a second post, or your site turned it
  down.

## 1.1.0

- When you publish a note for the first time, In the Open finds your
  published posts that link to it, and offers to update them. Their links
  were plain words while the note had no post, and now they go to it.

## 1.0.3

- Before you publish, a link to a note without a post is listed by the words
  your post will show, which are the link's alias when it has one. The list
  used to show the note's name, which read as if the post would show that.
- A link to a note that's only a draft is now plain words in your post, like a
  link to a note you haven't published. It used to go to the draft's address,
  which is only meant for people you give it to.

## 1.0.2

- Messages, settings descriptions and the README use plainer words, with less
  of Micropub's own vocabulary.
- After an update, a withdrawal or a restore, the notice no longer says your
  site shows it "once it has built it". Not every site builds its pages, so
  it now says a site that does may take a moment.
- The message about an image that isn't PNG or JPEG now says that In the Open
  only sends those two. It used to say your site only takes them.
- The README no longer says your site needs the references extension to show
  a reference list. Every Micropub site gets one.

## 1.0.1

- A post changed on your site since you last published it is asked about
  again, with **Replace it** to send the note anyway, as 1.0.0 meant: it
  stopped with "… refused it: …" instead.
- A note is sent once at a time: publishing it again while it is being sent,
  from a hotkey, a command or a menu, says so, rather than making a second
  post.
- Publishing a withdrawn post asks you to restore it first, and Restore only
  works on a withdrawn one, so the note and your site agree on where the post
  stands.
- A site address that isn't one, or isn't https, is said before anything is
  asked or written into the note, not as "Invalid URL" afterwards.
- When your site takes a post but doesn't say where it is, or its address
  can't be written into the note, the message says the post is there and how
  to keep the next publish from making a second one.
- Posts and images go with their length, not in chunks, which some servers
  take badly.

## 1.0.0

The first release, for the plugin directory: everything from the betas, as
1.0.0-beta.3 left it. Publish a note to your website over Micropub, with its
citations formatted and its reference list, its images, drafts, updates,
categories, and withdrawing and restoring a post; and without pandoc
installed, with pandoc's own built-in version.

## 1.0.0-beta.3

- Publish without pandoc installed: In the Open offers to download pandoc's
  own built-in version the first time, 17 MB, once, and runs it inside
  Obsidian. An installed pandoc still comes first. Tested with pandoc 3.13,
  up from 3.7, whose reference lists differ slightly: a journal article
  without a journal now has its title in italics.

## 1.0.0-beta.2

- A category your site doesn't have yet is asked about before anything is
  sent, with the ones it does have, instead of stopping the publish: a site
  that takes new categories makes it. **Set categories** takes a new one too,
  and opens with the note's own when your site doesn't list its categories.

## 1.0.0-beta.1

- Publish a note to your website over Micropub, with its citations, its
  reference list and its images, and update it by publishing it again. An
  update says what changed, sends nothing when nothing did, and asks before
  replacing a post that was changed on your site.
- Withdraw a post, and restore it, without breaking the links to it. Say
  why, and a site that takes it shows the reason on the post's page.
- Publish a note as a draft first, to see it on your site before anyone
  else does, on a site that takes drafts. Withdrawing a draft discards it.
- New post makes a note from a post template, which is yours to edit.
- Publishing a note without a summary asks for one first, and keeps it in
  the note.
- A category your site doesn't have is caught before anything is sent, with
  the ones it does have. **Set categories** offers your site's categories to
  pick from.
- A post's title bar shows where it stands, Draft, Published or Withdrawn,
  and its next step: publish as a draft, then publish. The note keeps it as
  `post-status`.
- A site that takes the references extension gets the post as Markdown with
  its references apart; any other gets it as HTML.
