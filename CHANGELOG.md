# Changelog

What changed in each release of In the Open, newest first. What counts as
breaking is in [Compatibility](docs/compatibility.md).

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
