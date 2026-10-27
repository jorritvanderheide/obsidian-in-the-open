# Architecture

In the Open turns a note into a Micropub post and sends it to your site. What a
post looks like on the wire is specified in [Micropub](micropub.md):
Micropub, and the references extension. That page is the contract, and a
change to what is sent is made there first.

## Layers

Every decision about a note, its citations and pandoc's command line is in
[obsidian-citation-core](https://codeberg.org/BW20/obsidian-citation-core), a
library In the Open shares with Due Credit and bundles into `main.js`. What is
left here is In the Open's own: its settings, Micropub, and wiring the core to
Obsidian.

| Path | What it holds |
| --- | --- |
| `src/main.ts` | The plugin. Nothing is registered yet. |
| `src/modules.d.ts` | What esbuild bundles from the core: its filters as text and its font as bytes. |

**Every decision belongs in the core**, or, for Micropub, in pure code here
with a test named after it. Commands and the settings tab wire it to
Obsidian and decide nothing.
