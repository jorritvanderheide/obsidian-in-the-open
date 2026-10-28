# Frequently asked questions

Can't find your answer here? Please
[open an issue](https://github.com/jorritvanderheide/obsidian-in-the-open/issues/new/choose).

- [Connecting to your site](#connecting-to-your-site)
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

## Publishing

### "… has no category …, which … has under categories."

The note's `categories` property names a category your site doesn't have.
Before it makes the post, In the Open asks your site which categories it has
(`q=category`), and stops here rather than send a post the site would refuse.
The message lists the ones the site has. Change the note's `categories` to
one of those, or add the category to your site first, the way your site does
that.
