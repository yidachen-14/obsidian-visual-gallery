# Visual Gallery development constraints

Preserve settled interaction and visual requirements. Bug fixes must be scoped;
do not redesign unrelated card styles, icons, gradients or selection behavior.

## Mandatory card geometry contract

Read `docs/CARD_GEOMETRY.md` before changing card DOM or card/preview/detail CSS.
One clipped surface and one OUTSIDE stroke layer are required in ALL states.
Do not introduce an inset border, duplicate ring, independent corner radius,
layout border/padding or individually rounded cover/detail panels.

Before handing off any card-style change:

1. Run the production build (includes `tests/card-geometry.test.ts`). Never
   loosen/delete its contract assertions just to make a style change pass.
2. Run `scripts/check-card-geometry.js` in real Obsidian (or with its installed
   host CSS via `scripts/check-outline-browser.js`). Reject any failures.
3. Inspect light/dark screenshots of normal AND selected cards at all four
   corners, including the bottom corners, and test hover/focus/drop states.
4. Preserve fractional heights, 125%/150% zoom, mixed-title stretched rows,
   metadata on/off and widths 180/190/210/220/250/360 px in the test matrix.

Changing this contract requires an explicit user request, a documented reason,
and updated real-render evidence. Rectangular bounding boxes alone do not prove
rounded strokes match. Do not call browser fixtures application E2E evidence.
Do not overwrite an already published version; increment the patch version.

## Settled gallery layout and settings

- Header controls align to the last occupied card column when it can fit the
  title and controls. For sparse/narrow galleries, expand only the header as
  needed (never beyond the pane) and keep the grid's exact occupied width.
  The title and toolbar must remain on one row; truncate the title instead
  of wrapping below it, including the actual <=720px viewport breakpoint.
- The user's explicit 2026-10-01 toolbar redesign supersedes the old text
  filter/sort controls. The later explicit merge request requires exactly three
  ICON-ONLY buttons in order Create (+), Sort, Filter. The plus opens a native
  menu ordered New note, New Canvas, New folder; choosing an action then opens
  the existing naming dialog. Do not restore permanent
  filter/sort labels, select elements or extra chevrons in the header.
  Match native file-explorer nav buttons, provide translated tooltips and
  accessible names (including current sort/filter), and show one checked option
  in each sort/filter menu. An active filter may tint its single icon.
  Reuse renderGalleryToolbar for host-style fixtures. Size the three-button
  group from its buttons, not translated label widths; all three remain visible
  in normal/narrow panes. Grid occupied width and card geometry stay unchanged.
- Folder artwork is centered by its visible bounds within the cover (not the
  whole card). Font glyphs require ink metrics, not baseline-box centering.
- Folder and note gradients have independent light/dark pairs. Preserve old
  custom shared colors during migration and never overwrite the other group.
- Rename is a single-selection operation. Multi-selection context menus must
  omit it; right-clicking an unselected card may first select that card alone.
- Toolbar SVGs are aria-hidden and pointer-transparent. Use real Obsidian
  icons and native Menu; no theme background images or duplicate icon layers.
- Settings use native purpose-based headings. Every offered language must have
  a complete dictionary, matching interpolation tokens and translated icon
  labels. Share the catalog; do not add picker-only or English-fallback locales.
  Language changes must preserve saved appearance and update command/ribbon text.
- Folder `dragover` and `drop` must reach Obsidian's window drag manager.
  `preventDefault` claims the drop; never stop propagation, which freezes the
  native filename ghost and blocks its drop cleanup. Cover descendants and
  breadcrumbs must follow the same rule. Gate with gallery-events tests and
  the before/after native `scripts/check-drag-ghost.js` regression check.

Use `tests/gallery-layout.test.ts`, `tests/settings-model.test.ts` and menu/icon
tests as build gates. For host rendering, run `scripts/check-gallery-layout-colors.js`
in the existing ego task space with `VG_QA_SPACE` set; the disposable native
integration checks are `scripts/check-gallery-014.js` (historical 0.1.14) and
`scripts/check-gallery-015-context.js` (historical 0.1.15). For the three-button
toolbar run `scripts/check-toolbar-017-browser.js` in the same task space after
the host fixture. The 0.1.16 toolbar scripts are historical five-button checks.
Restore test preferences; do not revise historical evidence
scripts to pretend the old dropdown UI is still present.

File-explorer integration uses the host's `file-explorer-context-menu` source
and the clicked item, never the active editor file. Reuse the gallery leaf,
clear its transient filter for explicit reveal, select/scroll the file after
its progressive-render chunk exists, and reject stale references. Other host
context menus must remain unchanged. New Canvas writes valid empty JSON Canvas
through Vault.create; reject invalid names/collisions without overwriting.

## Native navigation history

GalleryView is navigable. Folder cards and breadcrumbs must call the same
leaf's public setViewState BEFORE mutating the current folder, so the host
captures the old page. setState marks ViewStateResult.history only for actual
folder changes; the host suppresses history on popstate. Never maintain a
parallel stack, call private leaf history methods in production, or intercept
mouse buttons 3/4: Obsidian already routes these through its native history.
Preserve each page's filter/sort and avoid duplicate/stale folder destinations.
Missing/deleted folder states recover safely to the vault root. Keep navigation
enabled so opening a note in the same pane can return to the gallery.
Gate with tests/gallery-history.test.ts and gallery-events tests. Native
checks in scripts/check-history-018-native.js are disposable-vault-only;
synthetic events are not proof of physical mouse hardware handling.
