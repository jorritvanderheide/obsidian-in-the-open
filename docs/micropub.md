# Micropub

What In the Open sends to a site, and what a site has to do to take it.
In the Open speaks [Micropub](https://www.w3.org/TR/micropub/), the W3C
Recommendation for posting to a website, with one small extension for
references. So it is not tied to one site: any site with a Micropub endpoint
takes its posts, and a site that implements the extension takes its
references too.

This page is the contract between In the Open and your site. Where it says
nothing, Micropub's rules apply. In the Open sends every request as JSON, and
updates a post by replacing what changed (`replace`), so a site needs
neither form-encoded requests nor `add` and `delete`.

## Finding the endpoint

You give the plugin a site's URL and a token. The plugin finds the endpoint
from the site's `rel="micropub"` link, in the page's head or its `Link`
header, as Micropub says, and asks it for its configuration:

```http
GET /micropub?q=config
Authorization: Bearer <token>
```

```json
{
  "media-endpoint": "https://example.org/micropub/media",
  "references": 1,
  "post-status": ["published", "draft"]
}
```

- `media-endpoint` is where images go. Without it, a note with images is not
  published.
- `references` is the version of the extension the site takes. A site that
  takes it gets `content` as Markdown and the works the post cites. Without
  it, a site gets `content` as HTML, and the citations as
  [References](#references) describes.
- `post-status` lists the statuses a post can have. With `draft` in it, the
  plugin can send a draft; see [Drafts](#drafts). Without it, the plugin
  sends none, because a site that doesn't know Micropub's `post-status`
  publishes a draft at once.

`GET /micropub?q=category` lists the site's categories,
`{"categories": ["tech", "notes"]}`, so the plugin can offer them rather than
let you type one the site will refuse.

## Tokens

Every request carries `Authorization: Bearer <token>`. How a site issues
tokens is its own business: IndieAuth, or a long random string in a file. The
plugin takes one pasted into its settings. A missing or unknown token is
`401`; a token that may not do what it asks is `403`.

## A post

A new post is a JSON create request:

```http
POST /micropub
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "type": ["h-entry"],
  "properties": {
    "name": ["The NixOS module system is a quiet revolution"],
    "summary": ["Why declarative configuration changes how we think about infrastructure."],
    "content": ["As archivists note [(Marsh 2020, 12)](#ref-marsh2020), ..."],
    "category": ["tech"],
    "mp-slug": ["nixos-module-system"],
    "references": [{ "key": "marsh2020", "text": "Marsh, Ann. 2020. ..." }]
  }
}
```

| Property | Required | What it is |
| --- | --- | --- |
| `name` | yes | The title. |
| `content` | yes | The text. To a site that takes the references extension, a plain string of CommonMark, with GFM tables, strikethrough and footnotes. To any other site, HTML, as `{"html": "..."}`, because Micropub reads a plain string as plain text. |
| `summary` | | One sentence about the post. |
| `category` | | Its categories. |
| `mp-slug` | | The slug it should have. The site may choose another. |
| `published` | | When it was published. Without it, the site uses the time it received it. |
| `post-status` | | `draft` for a draft; see [Drafts](#drafts). Without it, the post is published. |
| `references` | | The works it cites; see [References](#references). |

The site answers `201 Created`, or `202 Accepted` when the post appears only
later, after a build. Either way the post's URL is in `Location`. The plugin
keeps that URL in the note: it is how the plugin updates the post, and how
other notes link to it. After a `202`, the plugin asks for that URL every
few seconds until it answers `200`, so it can say when the post is live, or
that it still isn't after a few minutes.

### Links and images

- **Every link is an absolute URL**, or a `#ref-<key>` citation. A link to
  another post on the same site is that post's URL, as its `Location` gave
  it.
- **Every image is a URL the media endpoint returned**, and has alt text.

Each image is uploaded before the post, to the media endpoint, as
`multipart/form-data` with the file in a field called `file`. The endpoint
answers `201 Created` with the file's URL in `Location`.

## References

The extension, version 1.

A citation in `content` is a link: the in-text form of one work as its
words, and `#ref-<key>` as its target. A citation of several works is one
link per work:

```markdown
As archivists note [(Marsh 2020, 12)](#ref-marsh2020), and others since
([Lee 2021](#ref-lee2021); [Okafor 2023](#ref-okafor2023)).
```

`references` lists every work cited, each once, in the order of the
reference list:

```json
"references": [{
  "key": "marsh2020",
  "text": "Marsh, Ann. 2020. *Archives and Their Readers*. Leiden: Brill.",
  "url": "https://doi.org/10.1163/example",
  "csl": { "id": "marsh2020", "type": "book", "...": "..." }
}]
```

- `key` is the work's citation key: ASCII letters, digits, `-` and `_`. It
  names the same work in every post, for good, so a site may put it in a URL.
- `text` is the formatted reference, as inline CommonMark: emphasis and
  links, nothing else.
- `url` is optional: where the work can be found, preferably its DOI.
- `csl` is optional: the work as CSL-JSON, for a site that would rather
  format it itself.

Every `#ref-<key>` in `content` has an entry, and every entry is cited at
least once. A site that takes the extension refuses a post where that does
not hold. What it does with the links is up to the site: a reference list on
the page with `id="ref-<key>"` on each entry, as pandoc makes, works as is.

A site whose configuration has no `references` gets no such property. Each
citation is plain text instead of a link, and the reference list comes at
the end of `content`, under a "References" heading.

## Changing a post

Publishing a note again sends an update, which replaces everything the
plugin owns:

```json
{
  "action": "update",
  "url": "https://example.org/log/nixos-module-system/",
  "replace": {
    "name": ["..."],
    "summary": ["..."],
    "content": ["..."],
    "category": ["..."],
    "references": [{ "key": "marsh2020", "text": "..." }]
  }
}
```

The slug and `published` never change. `updated` is added to `replace` only
when you mark the change as one of substance; correcting a typo leaves it
out. The site answers `204 No Content`.

## Drafts

A draft is a post on the site that only its address leads to, so you can see
it as readers will before they can. The plugin sends one as a new post with
`"post-status": ["draft"]`, sends it again as an update while it is one, and
publishes it with an update that replaces `post-status`:

```json
{
  "action": "update",
  "url": "https://example.org/log/nixos-module-system/",
  "replace": {
    "post-status": ["published"],
    "name": ["..."],
    "content": ["..."]
  }
}
```

- **A draft is in none of the site's lists**, nor its feed, its sitemap or
  anything else that announces a post, and its page asks search engines not
  to index it. Otherwise it looks as the post will. Its address is unlisted,
  not secret.
- **A published post links to no draft**, since the link would lead its
  readers there. A site refuses a post that does.
- **Its date is when it is published**, not when it was drafted. The update
  that publishes it has no `updated`.
- **A published post never becomes a draft again.** A site refuses
  `"post-status": ["draft"]` for one.
- **Deleting a draft discards it**: it was never public, so nothing links to
  it and nobody has cited it. An undelete then finds no post.

To know whether a post is a draft, the plugin asks for its source, as
Micropub says. A site that takes drafts answers this:

```http
GET /micropub?q=source&properties[]=post-status&url=https://example.org/log/nixos-module-system/
Authorization: Bearer <token>
```

```json
{ "properties": { "post-status": ["draft"] } }
```

## Withdrawing a post

A published post is never deleted: other posts link to it, and people may
have cited it. A delete request withdraws it, and an undelete brings it back:

```json
{
  "action": "delete",
  "url": "https://example.org/log/nixos-module-system/",
  "reason": "The figures in section 2 are wrong."
}
```

- `reason` is optional: why it was withdrawn, a sentence of plain text for
  the post's readers. It isn't part of Micropub, so a site that doesn't know
  it ignores it. An undelete has none, and the reason goes with the
  withdrawal.
- **What withdrawn looks like is the site's choice.** As journals do with a
  retracted article, it should stay readable at its address, say clearly
  that it was withdrawn, when, and why, and leave the site's lists and feed.

Both answer `204 No Content`.

## Errors

Errors are Micropub's own:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error": "invalid_request", "error_description": "content: #ref-marsh2021 has no entry in references"}
```

The plugin shows `error_description` as it is, so a site writes it for the
person publishing: the field, and what is wrong with it.
