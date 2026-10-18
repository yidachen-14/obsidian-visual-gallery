# Sidebar folder artwork and vault home (0.1.21)

The dedicated Visual Gallery file browser now uses the reference interaction:
closed/open folder glyphs at rest, a right/down chevron in the same hit area
while hovering or focusing the row, recursive file totals on the right, and
a vault-name Home button above the scrolling tree. The reference is Gallery
Navigator 0.5.1; the implementation is original and uses Obsidian's icon API.

Only `.visual-gallery-explorer` styles are added. The 0.1.20 card DOM/CSS,
gallery toolbar, gradients, selection and thumbnail renderers are unchanged.
Native disclosure elements/listeners, folder persistence, single-click file
selection, double-click new tabs, menus and drag/drop are retained. The home
action goes through the shared public gallery navigation and native history;
its root drop target and context menu use the host's native handlers.
Home's Enter/Space handler stops only those keyboard events from reaching the
native Files Enter shortcut, which would otherwise open the focused file.
Drag event propagation is unchanged.

Counts include all files loaded by the Vault API under each folder, including
unsupported file types and descendants, and exclude folders themselves. One
iterative postorder walk produces all counts after structure changes; updates
are coalesced and cancelled when the view unloads. File contents/metadata are
not read for counts. Row metrics are invalidated after initial decoration and
theme changes so the host virtual tree measures the sidebar styles correctly.

Validation is scoped to macOS Obsidian 1.14.4 in a disposable vault. Existing
mobile automated tests pass; the new sidebar artwork has not been tested in
Android/iOS Obsidian. The native Files core-plugin dependency remains.

The native suite covers count updates after create/duplicate/delete, moving
files between folders, folder rename without duplicate glyphs, root navigation
with native Back, language changes, menus and original Files-tree isolation.
The pointer suite checks real renderer hover hit areas and icon/arrow state,
retained file selection and double-click behavior. It emulates renderer focus
when the isolated app is in the background; this is not physical mouse testing.

See `artifacts/gallery-0.1.21-*` and `scripts/check-explorer-021-native.js` /
`scripts/check-explorer-021-pointer.mjs` for evidence. Other feature ideas in
`GALLERY_NAVIGATOR_REVIEW.md` are suggestions only.

The production gate passes 332 Visual Gallery tests (507 across the workspace).
Native geometry checks pass all 648 cases; ghost checks report no stuck ghosts
or cleanup failures. Pointer checks cover 180/250/360 px sidebar widths and
Home keyboard activation. Three plugin reloads and a full process restart
retain exactly one sidebar, one Home button, one folder glyph slot per row,
the expanded folder state and correct file counts (`lifecycle-*.json`).
