# Frequently asked questions

Can't find your answer here? Please
[open an issue](https://github.com/jorritvanderheide/obsidian-in-the-open/issues/new/choose).

- [Connecting to your site](#connecting-to-your-site)
- [Pandoc](#pandoc)
- [Publishing](#publishing)

## Connecting to your site

### "… doesn't take your token. Check the token in Settings → In the Open."

Your site answered that the token In the Open sent isn't one it knows. The
token in **Token**, which Obsidian keeps in its keychain, has to be exactly
the one your site gave you. Spaces and line breaks around it don't count.

To see which side is wrong, send the token yourself, from a terminal, to your
site's Micropub endpoint (its home page names it, in a `Link` header):

```sh
curl -H "Authorization: Bearer <your token>" "https://example.org/micropub?q=config"
```

- **It answers with JSON**, such as `{"media-endpoint": …}`: your site has
  that token, so the one in Obsidian is a different one. Choose or create the
  secret again in Settings → In the Open → **Token**, and paste it.
- **It answers `unauthorized`** too: your site has a different token. Use the
  one it has, or give it this one, as your site's own documentation says.

### "… isn't an address In the Open can publish to. Set your site's address in Settings → In the Open, starting with https://, as https://example.org."

**Site** in the settings isn't a whole web address, or isn't https. Set it to
your site's home page as a browser shows it, such as `https://example.org`:
In the Open sends your token only over https.

### "… answered …, so its Micropub endpoint can't be found there."

Your site's home page, the address in **Site**, answered with an error, so
In the Open couldn't read where its Micropub endpoint is. Check the address
in **Site**: it's your site's home page, such as `https://example.org`,
and it has to load in a browser.

### "… doesn't say where its Micropub endpoint is: In the Open looks for a Link header or a <link> with rel="micropub" on its home page."

The home page loaded, but names no Micropub endpoint. A site that takes
Micropub says where, in a `Link` header or a `<link rel="micropub">` in its
page's head; your site's own documentation says how to turn it on.

## Pandoc

### "Download pandoc?"

In the Open can't find pandoc installed, so it offers pandoc's own built-in
version: 17 MB from pandoc's release on GitHub, once, kept outside your vault
and shared with Due Credit. If pandoc is installed but not found, Obsidian may
not see the same PATH as your terminal: set **Pandoc** in the settings to its
full path instead. Run `which pandoc` (macOS, Linux) or `where pandoc`
(Windows) in a terminal to find it.

### "Couldn't find pandoc at "…". Install it, or set its full path in Settings → In the Open."

**Pandoc** in the settings names a pandoc that isn't there. Fix the path, or
set it back to `pandoc`: then In the Open uses the one on your PATH, or offers
its built-in one.

### "Couldn't download pandoc: …"

The download from GitHub failed, or the built-in pandoc couldn't be kept in
your cache folder; the rest of the message says which. Try again later, or
install pandoc from [pandoc.org](https://pandoc.org/installing.html).

### "The built-in pandoc from … isn't the one this plugin was tested with, so it wasn't kept. Try again later, or install pandoc."

What came back from GitHub doesn't match the hash In the Open has for it, so
it wasn't kept or run. Try again later; if it keeps happening, install pandoc
from [pandoc.org](https://pandoc.org/installing.html).

## Publishing

### "… is withdrawn. Restore it first, then publish it again to update it."

A withdrawn post stays withdrawn on your site until it's restored, so
publishing the note would only change its text there. Run **Restore note**
first, then publish the note to update it.

### "… took the post but didn't say where it is, so … doesn't know its address. …"

Your site made the post but didn't answer with its address, so the note
can't keep it, and publishing again would make a second post. Find the post
on your site, and put its address in the note's `published-url` property
before you publish it again.

### "… is on your site, at …, but its address couldn't be written into the note: …"

The post was published, but writing its address into the note failed, for
example because the note was moved or its properties don't parse. Put the
address the message gives in the note's `published-url` property before you
publish it again, or it makes a second post.

### "… takes no drafts: it doesn't say so in its Micropub configuration, and a site that doesn't know drafts publishes one at once."

You sent a note as a draft to a site whose Micropub configuration doesn't
list `draft` under `post-status`. Such a site would publish it at once, so
In the Open doesn't send it. Publish the note instead, or ask whoever runs
your site to take drafts.

### "… is published already, at …, so it can't be a draft again. Publish it to update it."

A post goes from draft to published, not back. To change a published post,
publish the note again: that updates it. To take it down, withdraw it.

### "Every image on a website needs alt text, saying what it shows, and … has none. Write it after a |, as ![[bed.png|A raised bed in March]]."

A reader who can't see the image, or whose browser doesn't load it, gets its
alt text instead. Write it after a `|` in the embed, as
`![[bed.png|A raised bed in March]]`, and publish again.

### "… refused it: …"

Your site's Micropub endpoint refused the request, and the rest of the
message is what it said, such as a summary it requires, or a category it
doesn't take. Fix what it names in the note and publish again; if the
message is about the site itself, it's for whoever runs it.

### "A new category": "… has no category … yet."

The note's `categories` property names a category your site doesn't have yet.
Before it makes the post, In the Open asks your site which categories it has
(`q=category`), and asks you before sending a new one, since a new category is
often a typo of one that's there: the question lists the ones your site has.
**Publish** sends it, and a site that takes new categories makes it. A site
that doesn't says so, and the post isn't published. To change it, **Cancel**
and run **Set categories**.

### "… was changed on your site"

Your site says the post was changed there since you last published it from
this note: by hand, or by another tool. Publishing the note again would
replace that change, so In the Open asks first. **Replace it** sends the note
as it is. To keep the change, copy it into the note first, then publish. Only
a site that keeps track of this asks; any other is simply updated.
