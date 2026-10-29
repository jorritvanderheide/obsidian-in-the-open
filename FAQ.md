# Frequently asked questions

Can't find your answer here? Please
[open an issue](https://github.com/jorritvanderheide/obsidian-in-the-open/issues/new/choose).

- [Connecting to your site](#connecting-to-your-site)
- [Pandoc](#pandoc)
- [Publishing](#publishing)
- [Other](#other)

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

### "Your pandoc is version …, and it needs to be 3.6.4 or later. Update pandoc, or set the full path to a newer one in Settings → In the Open."

The pandoc In the Open found is older than 3.0, and can't read the links in
your note at all. Update it from [pandoc's website](https://pandoc.org/installing.html).
If you have a newer pandoc somewhere else, set its full path in **Pandoc**.

### "Your pandoc is version …, which turns some citations into plain text. Update it to 3.6.4 or later."

Pandoc 3.0 to 3.6.3 runs, but leaves some citations as plain text without
saying so. A citation key with a colon, like `[[smith:2017]]`, stays text, and
so does a link to a heading. Sometimes every citation stays as written.
In the Open says this once a session and publishes anyway.
Ubuntu 24.04 and Debian 13 install a pandoc in this range. Update it from
[pandoc's website](https://pandoc.org/installing.html), or set the full path
to a newer one in **Pandoc**.

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

### "Is … on your site already?"

The last time you published this note, its address didn't make it back into
the note. Obsidian may have closed while it was sending, the connection may
have dropped, or the note couldn't be written. Your site may have the post
anyway.

Open your site and look for it. If it's there, choose **Give its address** and
paste the post's address. In the Open checks that the page is there, writes
the address into the note, and the next publish updates that post. If it
isn't there, choose **Publish it as new**.

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

### "A link will be plain text on your site"

Before it sends, In the Open lists the links that will go out as plain words.
A link to a note you haven't published, or only sent as a draft, shows the
same words it shows in Obsidian: `[[Raised beds|my post on beds]]` becomes
"my post on beds", and `[[Raised beds]]` becomes "Raised beds". A draft's
address is only for the people you give it to, so a post never links to one.
When you publish that note, In the Open offers to update this post, and the
link goes to the new post.

The same list has links to papers your bibliography doesn't have, and links
to no note at all. Those go out as their names instead of citations. For a
paper, usually Better BibTeX changed the key, or its auto-export hasn't run
since you added the paper. A paper note without a citation key property is
looked up by its name, so it only cites when it's named for its key. You can
publish anyway, or cancel and fix the link first.

### "Your site won't show everything as Obsidian does"

The first time you send a note, In the Open lists what in it your site will
show otherwise than Obsidian does, or not at all: callouts, which are quotes
without their kind or folding, math and Mermaid diagrams, which show as their
code, embedded notes and plugin blocks, which are left out, and links to a
heading or a block in the note itself, which are their words. On a site that
takes Markdown, highlights and image widths too. [What happens to your
note](README.md#61-what-happens-to-your-note) has every one.

Nothing is wrong with the note. Choose **Publish anyway** to send it as the
list says, or **Cancel** to change it first. In the Open asks only the first
time, so an update doesn't ask again.

### "A post links to …" or "… posts link to …"

The note you just published is public for the first time, and some of your
published posts link to it. They went out while it had no post, so the link
shows as plain words. Choose **Update it** or **Update them**, and each one is
published again, one at a time, with the link to the new post. You get the
usual questions for an update, like whether it's a real change.

Each update sends its note as it is now. If you've changed one of them since
you published it, and you're not ready to send that yet, choose **Cancel** and
update that post later yourself. Drafts aren't listed: a draft picks up the
link when you publish it.

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

## Other

### Does it work on mobile?

No. In the Open runs pandoc, installed or built-in, and both need parts of
Obsidian that only the desktop app has.

### Why don't the commands have hotkeys?

You already have hotkeys In the Open knows nothing about, and a default that
collides with one of yours is worse than no default. Pick your own in Settings
→ Hotkeys.
