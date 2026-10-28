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
site's Micropub endpoint, the address it takes posts at. Its home page names
it, in a `Link` header or a `<link rel="micropub">` tag:

```sh
curl -H "Authorization: Bearer <your token>" "https://example.org/micropub?q=config"
```

- **It answers with JSON**, such as `{"media-endpoint": …}`. Then your site
  has that token, and the one in Obsidian is a different one. Choose or create
  the secret again in Settings → In the Open → **Token**, and paste it.
- **It answers `unauthorized`** too. Then your site has a different token. Use
  the one it has, or give it this one, the way your site's own documentation
  says.

### "… isn't an address In the Open can publish to. Set your site's address in Settings → In the Open, starting with https://, as https://example.org."

**Site** in the settings isn't a whole web address, or isn't https. Set it to
your site's home page as a browser shows it, such as `https://example.org`.
In the Open only sends your token over https.

### "… didn't load, so In the Open can't find out where to send posts (error …). …"

Your site's home page, the address in **Site**, answered with an error. In the
Open looks on that page for where to send posts, so it couldn't go on. Check
that **Site** is your site's home page, such as `https://example.org`, and
that it opens in a browser.

### "… doesn't say where to send posts. …"

The home page loaded, but it doesn't point to a Micropub endpoint, the address
your site takes posts at. A site that takes Micropub says where it is, with a
`Link` header or a `<link rel="micropub">` in its page's head. Your site's own
documentation says how to turn it on.

## Pandoc

### "Download pandoc?"

In the Open can't find pandoc installed, so it offers to download pandoc's
own built-in version. That's 17 MB from pandoc's release on GitHub, once. It's
kept outside your vault, and Due Credit uses the same copy.

Is pandoc installed, but not found? Obsidian may not see the same PATH as your
terminal, the list of folders it looks in for programs. Set **Pandoc** in the
settings to pandoc's full path instead. To find that path, run `which pandoc`
(macOS, Linux) or `where pandoc` (Windows) in a terminal.

### "Couldn't find pandoc at "…". Check the path in Settings → In the Open, or set it back to "pandoc"."

**Pandoc** in the settings names a pandoc that isn't there. Fix the path, or
set it back to `pandoc`. Then In the Open finds an installed pandoc by itself,
or offers its built-in one.

### "Couldn't download pandoc: …"

The download from GitHub failed, or the built-in pandoc couldn't be saved in
your cache folder. The rest of the message says which. Try again later, or
install pandoc from [pandoc.org](https://pandoc.org/installing.html).

### "The pandoc download didn't match the version this plugin was tested with, so it wasn't used. Try again later, or install pandoc yourself."

In the Open checks every download against a fingerprint of the file it was
tested with, called a hash. This one didn't match, so it wasn't kept or run.
Try again later, and if it keeps happening, install pandoc from
[pandoc.org](https://pandoc.org/installing.html).

## Publishing

### "… is withdrawn. Restore it first, then publish it again to update it."

A withdrawn post stays withdrawn on your site until it's restored, so
publishing the note would only change its text there. Run **Restore note**
first, then publish the note to update it.

### "… took the post but didn't say where it is, so … doesn't know its address. …"

Your site made the post, but didn't send back its address. The note keeps
that address to know which post is its own, and without it, publishing again
would make a second post. Find the post on your site, and put its address in
the note's `published-url` property before you publish it again.

### "… is on your site, at …, but its address couldn't be written into the note: …"

The post was published, but writing its address into the note failed, for
example because the note was moved or its properties can't be read. Put the
address from the message in the note's `published-url` property before you
publish it again. Otherwise, publishing makes a second post.

### "… doesn't say that it takes drafts, so In the Open didn't send this one. …"

You published a note as a draft, but your site doesn't say it takes drafts.
When In the Open asks what it takes (Micropub's `q=config`), the answer
doesn't list `draft` under `post-status`. A site that doesn't know about
drafts would publish one straight away. Publish the note instead, or ask
whoever runs your site to add drafts.

### "… is published already, at …, so it can't be a draft again. Publish it to update it."

A post can go from draft to published, but never back. To change a
published post, publish the note again, and that updates it. To take it down,
withdraw it.

### "… has no alt text, the words a reader gets when they can't see an image. …"

Every image you publish needs alt text. A reader who can't see the image, or
whose browser doesn't load it, gets those words instead. Write them after a
`|` in the embed, like `![[bed.png|A raised bed in March]]`, and publish
again.

### "… turned the request down. It answered: …"

Your site didn't take what In the Open sent, and the rest of the message is
its own answer. It might name a summary it requires, or a category it doesn't
take. Fix what it names in the note and publish again. If the answer is about
the site itself, it's for whoever runs the site. When the site gave no reason,
the message says so, with the error number it answered.

### "A new category": "… has no category … yet."

The note's `categories` property names a category your site doesn't have yet.
Before it sends the post, In the Open asks your site which categories it has.
A new category is often a typo of one that's already there, so it asks you
first, and lists the ones your site has. **Publish** sends it, and a site that
takes new categories makes it. A site that doesn't says so, and the post isn't
published. To change the category instead, choose **Cancel** and run
**Set categories**.

### "… was changed on your site"

Your site says the post was changed there since you last published it from
this note, by hand or by another tool. Publishing the note again would replace
that change, so In the Open asks first. **Replace it** sends the note as it
is. To keep the change, copy it into the note first, then publish. Not every
site keeps track of this. One that doesn't is simply updated.
