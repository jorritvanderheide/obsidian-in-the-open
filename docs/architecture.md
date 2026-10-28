# Architecture

In the Open turns a note into a Micropub post and sends it to your site. What a
post looks like on the wire is specified in [Micropub](micropub.md):
Micropub, and the references extension. That page is the contract, and a
change to what is sent is made there first.

## Layers

Every decision about a note, its citations and pandoc's command line is in
[obsidian-citation-core](https://codeberg.org/BW20/obsidian-citation-core), a
library In the Open shares with Due Credit and bundles into `main.js`: making
a note a post (`prepare` with `post`, `postArgs`), which properties go along
(`postProperties`), links to published notes (`linkPosts`), and the
reference list apart (`post-references.lua`). What is left here is In the
Open's own: its settings, Micropub, and wiring the core to Obsidian.

| Path | What it holds |
| --- | --- |
| `src/core/settings.ts` | The settings shape, defaults and loading. Pure, with a test named after it. |
| `src/core/micropub.ts` | Micropub as In the Open speaks it: finding the endpoint, `q=config` and `q=source`, the requests' bodies, an answer's error, images and their upload. Pure, with a test named after it. |
| `src/core/status.ts` | Where a note's post stands, from its `published-url` and `post-status`. Pure, with a test named after it. |
| `src/core/template.ts` | The post template the plugin ships, and filling in its title. Pure, with a test named after it. |
| `src/http.ts` | What goes over the wire: Node's `https`, which never follows a redirect with the token. |
| `src/site.ts` | A site: its endpoint and what it takes, and the requests that carry the token. |
| `src/commands/publish.ts` | Publishing a note, as a draft or not, updating it, withdrawing and restoring it, and discarding a draft. |
| `src/commands/new-post.ts` | New post: a note from the template, seeded when it's missing, marked as a post. |
| `src/commands/set-categories.ts` | Set categories: the site's categories, from `q=category`, or a new one, picked and written to the note. |
| `src/ui/` | The settings tab, with the token as one of Obsidian's secrets, the dialogs, the category picker (`category-picker.ts`), and a post's pill and next step in its title bar (`title-bar.ts`). |
| `src/main.ts` | Registers the six commands, the file menu items, and the title bar, which follows the open notes. |
| `styles.css` | The title bar's pill. |
| `src/modules.d.ts` | What esbuild bundles from the core: its filters as text and its font as bytes. |

**Every decision belongs in the core**, or, for Micropub, in pure code here
with a test named after it. `commands/` and `ui/` wire it to Obsidian and
decide nothing.

## Publishing, from start to finish

1. **Check the settings.** The bibliography and citation style have to exist.
   A note without a summary is asked for one, which goes in the note.
2. **Ask the site what it takes.** Its home page names its Micropub endpoint
   (a `Link` header or a `<link rel="micropub">`), followed through redirects
   without the token; `q=config` says whether it takes the references
   extension, and so whether the post goes as Markdown or as HTML, where
   images go, and whether it takes drafts. For a note with a post, `q=source`
   gives that post as the site has it, draft or not. The token comes from Obsidian's
   keychain, and goes only over https, never through a redirect.
3. **Read the note**, from the editor when it's open, and **prepare** it with
   the core: a link to a note with a post on this site goes to the post.
4. **Confirm** the links that won't be links: to notes without a post, and to
   papers the bibliography lacks.
5. **Check the images:** each needs alt text, and is a PNG or a JPEG.
6. **Upload the images** to the media endpoint, and put their addresses in
   the note.
7. **Run pandoc**, the installed one or the built-in one (the core's
   `pandocFor`, which asks before downloading it), with the core's `postArgs`,
   every path as that pandoc sees it (`seen`), from a temporary folder, and read
   the post and, as Markdown, its references.
8. **Compare, for an update,** with the post as the site has it
   (`differences`): what changed is said, and nothing changed is said too,
   and nothing is sent, unless the note has pictures, which can't be compared.
   For a published post, ask whether the change is one of substance: only then
   does the post say it was updated.
9. **Send it**, as a create or an update, with `post-status` for a draft or
   a draft being published. A site's `409`, for a post changed there since,
   is asked about, and with your yes the update goes again with
   `mp-overwrite`. A new post's address goes into the note's
   `published-url`, and when the site answers `202`, In the Open asks for
   that address every five seconds, for five minutes at most, and says when
   the post is live.
