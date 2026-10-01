# Visual Gallery

Browse your Obsidian vault as a visual card gallery, with thumbnails of the **whole Canvas**, not just its first image. Visual Gallery is an independent, desktop-only community plugin.

## Features

- Whole-Canvas previews: text, groups, connections, local images, Markdown excerpts and nested Canvases.
- Markdown covers from `cover` frontmatter or the first embedded local image; readable excerpts for notes without covers.
- Image previews and locally rendered PDF first-page thumbnails.
- Folder cards, breadcrumbs, file-type filters and Obsidian-style sorting by name, modification time or creation time in either direction.
- Single-click to select; double-click to open. Command/Ctrl-click toggles individual cards, Shift-click selects a range, and dragging blank space selects a rectangle. Escape or a blank-space click clears selection.
- Drag files and folders to gallery folders, breadcrumbs or the native file explorer. Dragging an unselected card works immediately; dragging a selected card moves the selection.
- Right-click a card to rename it, delete it or reveal its original file in Finder/system file manager. Right-click blank space to create a note or folder.
- English, Simplified Chinese, Traditional Chinese and Japanese interfaces. New installations default to English.
- Adjustable card width, gallery heading, light/dark cover gradients, folder icons and ribbon icons.
- Local thumbnail caching, lazy generation, progressive rendering and automatic removal of stale or orphaned previews.

## Installation

Once accepted into the Community directory, install **Visual Gallery** from **Settings → Community plugins → Browse**.

Until then, install manually from the [GitHub releases](https://github.com/yidachen-14/obsidian-visual-gallery/releases):

1. Download `main.js`, `manifest.json` and `styles.css` from the same release.
2. Create `<vault>/.obsidian/plugins/visual-gallery/` and put those three files inside it.
3. Reload Obsidian and enable **Visual Gallery** in **Settings → Community plugins**.

PDF rendering is included in `main.js`; no separate worker, external service or download is needed. When updating manually, disable the plugin, replace those three files, and re-enable it. Keep your `data.json` to retain settings.

## Usage

Click the gallery ribbon icon, or run **Visual Gallery: Open Visual Gallery** in the command palette. The gallery opens in the active note's folder. Use breadcrumbs to navigate, the file-type filter to narrow the cards, and the sort menu to reorder files. Folders remain first and sorted A–Z, like the native file explorer.

For multiple selections, use Command on macOS or Ctrl on Windows/Linux. Command/Ctrl+A selects currently displayed filtered cards. Shift-click and Shift+arrow keys extend a range. Drag from blank gallery space to select files and folders together.

Drag-and-drop and rename act on **original files**, not previews. Moves through gallery targets check name conflicts and invalid folder nesting before starting the batch. If a disk error interrupts a batch, a notice reports how many items moved; already completed moves are not automatically rolled back. Link updates follow Obsidian's preferences. Back up your vault before reorganizing important files.

**Delete uses Obsidian's native deletion flow and preferences.** If you disabled confirmation or selected permanent deletion in Obsidian, those preferences also apply here. The card menu acts on the right-clicked item, not the entire selection.

Settings include a read-only cache location and **Clear thumbnail cache**. Clearing the cache removes disposable previews only; the next gallery visit regenerates them. Commands can also rebuild all Canvas previews or generate a preview for the active Canvas.

## Privacy and storage

- No account, payment, ads, telemetry or analytics are required.
- The plugin makes no network requests, uploads no vault contents and loads no remote thumbnail images. Link nodes show a simplified URL card; remote covers are not fetched.
- Preview generation reads files within the vault. Settings and generated WebP previews are stored inside the plugin directory, normally `<vault>/.obsidian/plugins/visual-gallery/thumbnail-cache/` (or the vault's custom configuration directory).
- Canvas rendering does not modify the source board or notes. Rename, move, create and delete happen only through the corresponding user actions. Automatic cleanup removes this plugin's generated cache entries, never original vault files.
- **Show in Finder/system file manager** resolves the original vault item's local path and asks the operating system to reveal it. It does not read arbitrary files outside the vault.
- Any synchronization service you configured for the vault may also synchronize the plugin's cache and settings. Cache files contain visual previews of your notes.
- The plugin does not install or update itself; updates use Obsidian or manual installation.

## Compatibility and limitations

Desktop Obsidian **1.13.7 or newer** is required. Native UI integration was tested on macOS with Obsidian 1.13.7; Windows/Linux-specific file-manager behavior has not been independently tested. Mobile is not supported.

Canvas previews are a Canvas2D reconstruction, not screenshots of Obsidian's Canvas. Full Markdown layout, remote embeds, custom plugin nodes and theme-specific details are not reproduced exactly. Very wide or tall boards preserve the whole board, so individual nodes may look small.

Interoperability with the native file explorer uses a guarded internal drag API. If that API changes, the adapter may need an update. PDF previews show only the first page and do not prompt for encrypted-document passwords.

## Development

Use Node.js 22 and pnpm 10.12.1:

```sh
corepack enable
corepack prepare pnpm@10.12.1 --activate
pnpm install --frozen-lockfile
pnpm run build
```

The build runs the type checker and tests before generating `main.js`. `pnpm run dev` watches source files. Use a disposable test vault for file-management testing. Build outputs and personal vault contents are not committed.

The bundled PDF worker is loaded as a local Blob worker and released when the plugin unloads. Third-party attribution and the full PDF.js license are embedded in the distributed bundle as well as included in this repository.

## License and credits

See [LICENSE](LICENSE) for this project's license and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and third-party licenses. PDF.js is licensed under Apache-2.0; its full license is also in [PDFJS_LICENSE.txt](PDFJS_LICENSE.txt).

Rendering and cache design draw on Embed Canvas, Gallery Navigator, the JSON Canvas specification and the official Obsidian sample plugin, as documented in the notices. This plugin is not an official Obsidian product.

Report problems through [GitHub Issues](https://github.com/yidachen-14/obsidian-visual-gallery/issues), including the plugin version, Obsidian version, operating system and reproduction steps. Do not post private vault contents.
