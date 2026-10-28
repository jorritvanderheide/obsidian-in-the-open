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
