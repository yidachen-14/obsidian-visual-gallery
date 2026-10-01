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
  The title and both controls must remain on one row; truncate labels instead
  of wrapping below the title. This exception was requested on 2026-10-01.
- The filter control fits its active label; do not restore a fixed/minimum width
  or size it using the longest inactive option.
- Folder artwork is centered by its visible bounds within the cover (not the
  whole card). Font glyphs require ink metrics, not baseline-box centering.
- Folder and note gradients have independent light/dark pairs. Preserve old
  custom shared colors during migration and never overwrite the other group.
- Rename is a single-selection operation. Multi-selection context menus must
  omit it; right-clicking an unselected card may first select that card alone.
- The compact filter's arrow is an aria-hidden, pointer-transparent SVG, not a
  theme background image. Retain the active-label width and occupied-row edge.
- The sort menu has its own pointer-transparent chevrons outside the label.
  Only the label may ellipsize; never truncate/remove the icon in long languages.
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
integration check is `scripts/check-gallery-014.js`. Restore test preferences.
