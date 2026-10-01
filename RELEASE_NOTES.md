# Visual Gallery 0.1.10

- Updated the bundled PDF engine to PDF.js 5.4.624, compatible with Obsidian 1.13.7. The obsolete script-injection fallback and its vulnerable legacy dependency chain are no longer present.
- PDF workers use a local module Blob; remote worker/asset fetching and optional WebAssembly loading are disabled. PDF files are supplied as vault bytes.
- Settings headings now use Obsidian's native Setting heading API.
- Tightened drag type narrowing and Markdown cover metadata typing.

## 0.1.9

Community-release preparation:

- PDF.js's worker is embedded in `main.js`, so the standard three-file Obsidian installation supports PDF thumbnails without an extra download.
- Worker creation is lazy, shared across PDF previews and cleaned up on plugin unload.
- Third-party notices and the complete PDF.js license travel inside the bundle.
- Added public usage, privacy, storage and compatibility documentation plus a reproducible build workflow.
- Minimum Obsidian version is 1.13.7, matching the tested desktop integration.

## 0.1.8

- Match the six built-in file-explorer sorting choices, paired separators and active checkmark. Support file-name ascending/descending, modification time in both directions, and creation time in both directions. Retain folders first in A–Z order and preserve old saved sort preferences. Settings offer the same defaults.
- Add Delete and Show in Finder to card context menus. Delete delegates once to Obsidian's native `promptForDeletion` flow and follows the vault's confirmation/trash/backlink/attachment preferences; it affects the clicked item. Finder reveals the original local file/folder, never its thumbnail cache.
- Add heart, gear and tree folder icons, bringing the icon-only folder picker to ten choices in two rows of five at normal width. Retain the original glyph and centered visible artwork.
- Add New note and New folder to blank-space context menus. A name dialog creates the item in the current gallery folder without overwriting; new notes open in a new tab and folders refresh immediately. All new text is available in English, Simplified Chinese, Traditional Chinese and Japanese.

Verified: 57 automated tests, type check, production build and ZIP integrity. In the disposable Obsidian 1.13.7 vault, the real native sort menu exposes all six choices; choosing Z–A reorders cards correctly. Blank-space right-click and name dialogs created a folder and an empty note inside it, and the note opened in a new tab. Finder selected the original sample note. The native Delete confirmation appeared and Cancel retained the note; actual deletion was not executed. A developer-console integration check verifies all six sort orders, ten folder/navigation choices, two rows of five folder choices and all three new SVG icons' centers. No formal personal-vault notes or installation were changed.

## Previous release: 0.1.7

- Center the folder icon's visible SVG artwork, not only its viewport. Anchor its container to all four cover edges and place the divider in the details area, eliminating the remaining vertical offset.
- Remove the duplicate folder-open option: Obsidian aliases folder to folder-open. Retain seven distinct choices including the original ⌑ glyph; existing folder-open preferences fall back to folder.
- Fix native color swatches at 32×32 px inside a 44×44 px square control with 6 px padding. This overrides Obsidian's internal swatch dimensions rather than fixing only the outer input. Circles and their focus rings have room to remain uncut.
- Add Japanese for the gallery, settings, icon labels, dialogs, commands and notices. English remains the fresh-install default; existing preferences are preserved.

Verified: 36 automated tests, type check, production build and ZIP integrity. Browser layout checks load the installed Obsidian 1.13.7 CSS and real icon assets: light/dark modes × five widths pass for all six SVG folder choices with zero center offset. Four native color-input shadow swatches measure 32×32 px with 50% corner radii and 6 px wrapper padding. This is host-stylesheet browser validation, not a new native Obsidian application E2E pass. Personal-vault notes and installation were not changed.

## Previous release: 0.1.6

- Give color swatches a square 32 px box, uncut circular edges and vertical breathing room.
- Center folder SVGs with a fixed-size flex container and block SVG, removing inline baseline spacing.
- Clip preview and details together on one rounded surface; eliminate the cover's layout-border inset and corner wedges. Preserve the uniform external 2 px selection ring.
- Remove Canvas thumbnail padding and extend its matching background to all cover edges. Keep the complete board visible without cropping nodes when aspect ratios differ.
- Replace text icon dropdowns with icon-only radio buttons, tooltips, accessible labels and arrow-key navigation. Retain the original 0.1.4 ⌑ folder glyph alongside the 0.1.5 folder icons.

Verified: 35 automated tests, type check, production build and archive integrity. `scripts/check-gallery-016.js` provides host-layout checks at five widths, icon-picker interactions and color-control geometry. This session's Obsidian input automation repeatedly timed out after opening its detached Settings window, preventing execution of the new host-layout check. Real host visual acceptance of 0.1.6 is not claimed. No personal-vault notes were modified.

## Previous release: 0.1.5

- Correct the inset selection ring: one uniform 2 px stroke now wraps outside the card; the preview and details clip their own corners so the outer stroke is not cut off.
- Add blank-space marquee selection of both files and folders, in either drag direction, with Shift addition, Command/Ctrl toggling, edge scrolling, and cancellation on Escape.
- Clear selection when clicking blank gallery space, including after Command/Ctrl and Shift selection. The click generated by releasing a marquee does not immediately clear its result.
- Set the default dark gradient start to RGB(38,38,38), #262626. Migrate the old #4a4a4a default once; retain other customized colors.
- Add separate folder-card and left-navigation icon settings, with localized labels and previews. Changes apply immediately.

Verification: 33 automated tests and production build. Developer-console integration checks in a disposable Obsidian 1.13.7 vault verify the outer stroke's geometry at four card widths, blank-space cancellation, synthetic pointer marquee selection in both directions with modifier combinations and cancellation, default color migration, and immediate folder/ribbon icon updates. A real gallery screenshot also confirms the outer stroke and uniform corners. Full OS-mouse marquee completion is not claimed: native coordinate automation could not locate the test window. No personal-vault notes were modified.

## Previous release: 0.1.4

- Draw selection with one uniform 2 px rounded stroke, replacing the overlapping border/spread-shadow ring.
- Add right-click Rename and F2; retain file extensions and update links through Obsidian.
- Add Command/Ctrl additive selection, Shift range selection, additive ranges, select-all, Escape, and arrow navigation. Drag selections together into gallery folders, breadcrumbs, or the native sidebar.
- Show cache location and a clear-cache action in settings; automatically remove invalid and orphaned Canvas/PDF thumbnails. Cache location is displayed, not editable.
- Rename the default home heading to Visual Gallery / 視覺圖庫 / 视觉图库 and allow custom text.
- Add Simplified Chinese and default fresh installations to English; preserve existing preferences.
- Add separate light/dark gradient color pickers for upper-left and lower-right cover backgrounds.

Verification: 30 automated tests and production build. In a disposable Obsidian 1.13.7 vault, a real right-click menu and rename dialog successfully renamed a note and refreshed the card. Synthetic DOM interaction tests passed for modifier selection, uniform stroke styles, two-file gallery and native-sidebar moves, three language headings, custom heading/colors, automatic cleanup after Canvas rename, and cache clearing. The settings page exposed all new controls. Full OS mouse-drag completion remains unverified; the most recent repeat UI pass was unavailable because Computer Use did not have access to Obsidian. The reference screenshot path was unavailable, so the ring correction was based on the CSS cause and computed-style validation.

## Previous release: 0.1.3

- Drag any card immediately, including an unselected card or its thumbnail area.
- Move original files/folders into gallery folders, breadcrumb folders, or Obsidian's native left file explorer.
- Disable thumbnail-image dragging and add source/target visual feedback.
- Reject duplicate destinations, no-op moves, and moving folders into themselves or their descendants. Gallery moves use Obsidian's FileManager so link updates respect vault preferences.
- Preserve single-click selection and double-click opening.

Verified: 19 unit tests and production build; synthetic drag events inside real Obsidian 1.13.7 successfully moved a note to a gallery folder, another note through the native sidebar handler, and a folder containing the first note. Contents stayed unchanged, links resolved, and the gallery refreshed. Native mouse automation confirmed unselected-thumbnail drag initiation, but did not deliver dragover/drop events, so full OS mouse-drag completion is not yet verified.

## Previous release: 0.1.2

Fixes the remaining top gap by overriding Obsidian's inherited button centering. Grid rows stretch cards to match the tallest title; shorter content previously gained 1.75 px of empty space above its preview in the reproduced case. Previews now stay top-aligned, and the details section absorbs any extra row height.

Card styles now also outrank Obsidian's `button:not(.clickable-icon)` rule, which had overridden the normal card shadow.

Verified in Obsidian 1.13.7: 60 browser-layout cases spanning light/dark styling, five widths, mixed Chinese/English titles, metadata on/off, and selection. Top and bottom gaps are zero, exact widths match, and every card has a shadow. Production build and all 14 unit tests pass.

## Previous release: 0.1.1

This build refines the gallery interaction and card styling for daily use.

## Changed

- removed the gray strip that could appear above some preview types
- left-aligned card titles with consistent inner spacing
- reversed the dark-mode note gradient from lighter upper-left to darker lower-right
- added English and Traditional Chinese interface settings
- made each card-width value produce an exact, visible width change
- changed card interaction to single-click selection and double-click opening
- added a Craft-style blue selection ring and softer raised card shadows

## Verified

- 14 automated tests pass.
- Five standalone Canvas fixture renders pass without warnings.
- Obsidian 1.13.7 smoke tests pass for Canvas, image, Markdown, text fallback, and PDF cards.
- Linked-note changes automatically refresh parent and nested Canvas thumbnails.
- Settings, including language and width, update the open gallery immediately.
- Rebuild-all completes successfully across the disposable test vault.

## Remaining limitations

- Canvas rendering is a JSON/Canvas2D reconstruction, not a pixel-perfect screenshot.
- Remote URL previews are intentionally not fetched.
- Mobile is not supported.
- Large personal-vault performance and visual taste still depend on the owner's real material.
