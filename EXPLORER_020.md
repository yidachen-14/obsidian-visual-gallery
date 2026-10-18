# Visual Gallery file browser (0.1.20)

The plugin adds `visual-gallery-explorer`, a dedicated left sidebar tab using
a separate instance of Obsidian's native Files view. The original Files tab
and its preferences remain independent. Opening Visual Gallery reveals this
sidebar tab; the command palette can reopen it after closing it.

- A folder label selects the folder and navigates the existing gallery leaf
  through public `setViewState`. Its disclosure arrow only expands/collapses.
- A file click selects it; Command/Ctrl-click toggles selection, Shift-click
  uses the native range selection. Double-click or Enter opens a new tab.
- All files loaded by Obsidian appear, including unsupported types. This does
  not change the vault's global `showUnsupportedFiles` preference. Hidden
  configuration files outside the Vault API remain outside the tree.
- Context menus, third-party `file-menu`/`files-menu` listeners, inline rename,
  duplication, confirmed deletion, clipboard, creation, sorting and native
  drag/drop come from the actual host Files instance.
- Fold storage uses `visual-gallery-explorer-unfold`, independently of
  `file-explorer-unfold`. Obsidian saves the sidebar view in its workspace.
- Rapid sidebar navigation is queued because the host ignores concurrent
  `setViewState` calls while a leaf is opening. Deleted/replaced targets are
  revalidated at navigation time. Native gallery history is retained.
- Tab/command/error labels cover all 18 existing languages. The native tree
  menus and controls follow Obsidian's own interface language.

## Compatibility and validation

The host does not publish its Files view API. `GalleryExplorer.ts` isolates
and checks the required capabilities before adapting a new instance; it never
patches host prototypes or the user's Files view. The Files core plugin must
be enabled. A future host API change may require an adapter update.

Production typecheck/build and the full workspace test suite pass: 502 tests,
including 327 Visual Gallery tests and 175 tests for the separate mindmap
project. Card DOM/CSS and card geometry assertions are unchanged.

`scripts/check-explorer-020-native.js` is restricted to disposable explorer
vaults. It exercises the real host's folder navigation/disclosure, selection,
new-tab opening, unsupported-file visibility, native single/multi menus,
inline rename, duplicate, confirmed delete, native history, rapid navigation,
unique sidebar and translated labels. It uses synthetic DOM input and is
not physical mouse hardware evidence.

Evidence is saved under `artifacts/gallery-0.1.20-*`. This feature is tested
on macOS Obsidian 1.14.4. Existing mobile automated tests pass; this sidebar
addition has not been verified in Android/iOS Obsidian.

- `native.json`: real menus, rename/duplicate/confirmed delete, mixed
  file/folder selection, sidebar moves, native history and rapid destinations.
- `pointer.json` and light/dark PNGs: trusted renderer pointer events for
  disclosure, navigation, selection, double-click and a third-party menu action.
- `hot-reload.json`: three disable/enable cycles, exactly one sidebar each time.
- `restart-before.json` / `restart-after.json`: full process restart preserves
  one sidebar and expanded `Projects` / `Projects/Nested`; original Files
  expansion storage remains untouched.
- `geometry.json`: 648 cases, zero failures. `drag-ghost.json`: 12 gallery
  descendant checks plus 6 sidebar checks, no stuck ghosts or cleanup failures.
  `check-drag-ghost-020-native.js` keeps the historical script untouched while
  measuring the CSS translate used by Obsidian 1.14. Its cleanup assertion runs
  after the native drop/dragend sequence; this host releases the ghost on
  source dragend rather than the old window-drop listener.
