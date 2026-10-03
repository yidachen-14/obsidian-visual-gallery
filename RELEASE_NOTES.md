# Visual Gallery 0.1.19 — mobile support

- Remove the desktop-only manifest restriction; add shared iOS/iPadOS/Android
  touch behavior without changing desktop mouse selection or navigation history.
- Tap opens; long-press selects and opens a native action menu. Tap other cards
  to toggle selection; Move selected items opens a vault-folder destination
  modal. Preflight collisions/nesting and revalidate originals before each move.
  Rename is single-selection-only. Finder is omitted on mobile; Delete remains
  the pressed-item native deletion flow, never silent batch deletion.
- Cancel long presses on scroll, pinch, movement, pointer cancellation or view
  unload. Suppress native duplicate menus and trailing clicks, including holds
  longer than two seconds. Keep exactly three toolbar icons and use 44 px
  mobile targets. All new menu strings are translated in all 18 languages.
- Reduce mobile Canvas concurrency/size/nested depth and PDF thumbnail size.
  Add HTML image decoding when ImageBitmap is missing and PNG cache fallback
  when WebP encoding is unavailable; retain original MIME types and clean both.
- Supply missing PDF Promise/base64/hex APIs in the page and bundled worker.
  Fail worker startup safely rather than hanging the queue. No remote worker,
  dependency upgrade, user settings migration or card style changes.

Verification: all 300 automated tests in 21 suites pass. Android phone/tablet
emulators running official Obsidian 1.13.8 pass plugin enablement, local
Canvas/image/PDF previews, native menus, multi-selection and batch moves,
cache cleanup/rebuilding, offline process restart and both orientations.
iPhone/iPad simulator WebKit checks pass rendering and touch-logic fixtures,
but use substituted Obsidian APIs and are NOT iOS Obsidian E2E. Physical
devices, older OS/WebViews and full iOS Obsidian integration remain unverified.
Existing card styles and desktop interactions are preserved. Requires
Obsidian 1.13.7 or newer. See docs/MOBILE_019.md for the evidence and limits.

# Visual Gallery 0.1.18

- Route folder cards and breadcrumbs through the existing leaf's public
  setViewState before changing the folder. Mark ViewStateResult.history for
  actual folder changes so Obsidian's native Back/Forward arrows record pages.
- Enable native view navigation. Mouse side buttons and configured host
  navigation shortcuts share Obsidian's history; no duplicate input handlers
  or parallel plugin history stack are added. A note opened in the same pane
  can return to its gallery page.
- Retain each visited page's filter/sort. Ignore duplicate/stale destinations;
  missing or deleted folder states recover to the root. Clear stale card
  selection when the folder actually changes. Card DOM/CSS, gradients, toolbar
  layout, outlines and drag behavior are unchanged.

Verified locally: production build and 266 tests in 20 suites. Nine tests
exercise the actual GalleryView with stub host base classes: state signaling,
back/forward, breadcrumbs, branching, duplicate/stale targets, page settings,
external reveal, deleted folders and selection cleanup. Installed Obsidian
1.13.7 source confirms native arrows and mouse buttons 3/4 route through its
history. This is source/unit evidence, not native mouse E2E. The disposable
installation received 0.1.18 runtime files, preserving data.json; native UI
testing stopped on user activity in the formal vault. No formal-vault runtime
or notes were modified. Physical side-button behavior and full native history
acceptance remain unverified; a guarded disposable-vault check is provided.
Local update package only; no external publication performed.

# Visual Gallery 0.1.17

- Merge New note, New Canvas and New folder into one **+** button. Its native
  text menu contains exactly those three actions in that order; choosing an
  action opens the existing naming dialog. Opening the menu creates nothing.
- Header order is now **Create (+), Sort, Filter** beside the folder title.
  Preserve translated tooltips, keyboard operation, sort/filter options and
  current checkmarks. Size the toolbar from its three actual buttons.
- Card DOM/CSS, outside strokes, gradients, selection, drag rules and existing
  creation validation are unchanged. Retain historical five-button QA separately.

Verified locally: 256 tests in 19 suites and production build. Installed
Obsidian 1.13.7 CSS/icon assets pass 864 layout, 216 sparse-header, 1,080
localized toolbar-state and 384 responsive cases, plus eight circular swatches.
All three browser pointer callbacks and keyboard opening of Create dispatch
correctly. Menu tests verify the three choices and deferred creation in all
18 interface languages. This is automated/host-style browser evidence, not
native Obsidian application E2E. No formal-vault installation or external
publication was performed. Local update package only.

# Visual Gallery 0.1.16

- Replace the header's text filter/sort controls with exactly five icon-only
  native-style buttons: **New note, New Canvas, New folder, Sort, Filter**.
  Keep the folder title visible; no persistent action labels or chevrons.
- Every button opens a native text menu. Creation choices use the existing
  naming dialog; sort/filter menus retain their full translated labels and
  mark the current choice. Tooltips and accessible names include current state.
- Keep title and all five buttons on one row, including the real narrow-window
  media breakpoint. Compress the button group only in narrow panes; preserve
  occupied-column alignment and the grid's exact width. Active filters tint
  their single icon. Card surfaces, strokes, gradients and drag rules are unchanged.
- Share production toolbar DOM with host-style QA and update development
  constraints to reflect this explicitly requested toolbar redesign.

Verified locally: 256 tests in 19 suites and production build. Actual installed
Obsidian 1.13.7 CSS/icon assets pass 864 layout cases, 216 sparse-header cases,
1,080 localized toolbar-state cases, eight circular swatches, 648 card-outline
cases with hover/focus checks, and 384 responsive
cases at viewport widths 360/720/900/1220 and 100%/125%/150% zoom. All five real
browser pointer actions and ArrowDown dispatch correctly. These host-style
browser fixtures are not Obsidian application E2E. Native UI testing was stopped
when the user was actively using the formal vault; no native mouse-menu or
personal-vault installation is claimed. Local update package only, not a
published GitHub/Obsidian release.

## 0.1.15

- Fix cropped active filter text in sparse galleries. Reserve its current
  label and decorative chevrons; only the sort label shrinks. Keep the title
  and both controls on one row and preserve exact occupied grid widths.
- Add **New Canvas** between **New note** and **New folder** in the blank-space
  menu. Write valid empty JSON Canvas through Obsidian's vault API and open it
  directly. Invalid names, stale folders and collisions cannot overwrite files.
- Add **Show in Visual Gallery** to the native file explorer's folder and
  supported-file menus. Folders open their contents; files reveal, select and
  scroll to their original card in the parent gallery, including later render
  chunks. Reuse the gallery tab and reset only its transient file-type filter.
- Translate all new menu and dialog labels in the existing 18 languages.
- Lock the no-shrink filter and native explorer-menu contracts in regression
  tests. Do not change card geometry, cover colors, icons or drag behavior.

Verified locally: 217 tests in 18 suites and production build. Installed-host
CSS checks pass 864 layout cases, 216 sparse-header cases, 2,694 filter-text
cases, eight native circular color swatches and 648 card-outline cases plus
hover/focus checks. The old 0.1.14 CSS fails the new text-cropping assertion.
The disposable native Obsidian 1.13.7 run passes 180 filter checks, 36 localized
explorer callback checks, file reveal, folder navigation and gallery-leaf reuse.
These callback checks are synthetic host integration, not OS-pointer E2E;
the original menu harness emitted unrelated core-plugin builder errors and was
corrected afterward. Full native mouse-menu/create-Canvas verification remains
uncompleted because the user resumed using the personal vault. User preferences
were restored and formal-vault files were not modified. This is a local 0.1.15
update package, not a published GitHub/Obsidian release.

## 0.1.14

- Keep the folder title, filter and sort on one header row, including empty,
  one-card and two-card galleries. Expand only the header when needed; retain
  exact card/grid widths and truncate long labels instead of wrapping controls.
- Restore the sort control's independent, pointer-transparent chevrons.
- Organize settings into seven native sections: interface, card layout,
  browsing defaults, icons, folder colors, note colors and thumbnail cache.
- Provide complete interfaces in 18 languages: English, Simplified Chinese,
  Traditional Chinese, Japanese, Korean, German, Spanish, French, Italian,
  Brazilian Portuguese, Russian, Ukrainian, Dutch, Polish, Turkish,
  Indonesian, Vietnamese and Thai. Language changes also update commands,
  the navigation tooltip and accessible icon labels without resetting colors.
- Include the unpublished 0.1.11–0.1.13 fixes: locked uniform outside card
  strokes, compact controls, centered folder artwork, separate folder/note
  gradients, no multi-selection Rename and smooth native drag-ghost tracking.

Verified: 189 automated tests and production build; host-style browser checks
cover 864 layout cases and 216 sparse-gallery cases. Native Obsidian 1.13.7
passes 18 settings-language checks, 1,080 toolbar checks, 72 sparse-header
checks, 648 outline cases and 60 full-surface cases. Native drag-manager
checks pass 21 gallery and nine sidebar positions with no frozen ghosts or
missed cleanup; synthetic no-op drops preserve all file paths. Native light/
dark captures were inspected. Full OS mouse-drag E2E and personal-vault
performance are not claimed. The user's saved appearance was preserved.

## 0.1.13

- Restore the compact filter's chevrons as an independent, aria-hidden SVG.
  It follows theme text color, cannot intercept pointer input and does not
  depend on a theme's dropdown background image/blending. Preserve active-label
  sizing and the toolbar's occupied-card-column alignment.
- Fix the native floating filename ghost freezing over gallery folders.
  Folder dragover/drop claim their targets with preventDefault but keep
  bubbling to Obsidian's window drag manager for pointer tracking and cleanup.
  Retain original native file/folder/multi-file payloads and move preflight.
- Add build gates preventing blocked drag-event propagation and disappearing
  or oversized filter icons. Do not change the locked card outline geometry.

Verified locally: 85 tests in 16 suites and production build. Native Obsidian
1.13.7 reproduces 21 stuck hover positions and three missed drop cleanups with
0.1.12; the same gallery file/folder/multi-selection checks pass with 0.1.13,
plus nine native sidebar hover positions. These are real host handlers with
synthetic drag events, not a full OS mouse-drag E2E claim. No-op drops leave all
vault item paths unchanged. Forty live filter/theme/language cases and an
actual native filter-menu choice pass. Browser host-style checks pass 192
layout cases; native 648 outline cases remain unchanged. Native light/dark
captures confirm visible chevrons, compact sizing and matching toolbar edges.
Preferences were restored; only the disposable test plugin was updated. This
is a local package, not a new public release.

## 0.1.12

- Hide Rename when right-clicking a selected card in a multiple selection.
  Preserve the single-card menu and normal right-click selection behavior.
- Fit the filter control to the active label and align filter/sort controls
  with the last occupied card column. Recalculate on pane, card width and item
  count changes; narrow panes use a fluid column without protruding controls.
- Center folder artwork within the colored cover. Retain all ten choices,
  including the original glyph; normalize its visible ink rather than its
  asymmetric font baseline box and retry after layout/fonts become available.
- Separate Folder cover colors and Note card cover colors, with independent
  light/dark gradient endpoints and translated headings in all four languages.
  Existing customized shared colors seed both groups on upgrade; subsequent
  changes remain independent. Image content is not recolored.
- Preserve the locked 0.1.11 outside-stroke geometry and add layout, migration,
  icon and multi-selection menu regression gates.

Verified locally: 81 automated tests and production build. Installed Obsidian
1.13.7 CSS/icon assets pass 192 layout/color cases across themes, four languages,
six card widths and four pane widths; all eight native swatches remain circular
and unclipped. Native Obsidian passes 144 layout cases with changing filters,
ten visible artwork centers, independent color input/save checks, 648 outline
cases, 60 full-surface cases and existing marquee/selection checks. Actual
native mouse/keyboard context menus omit Rename for multiple selection and
retain it for a single card. The real settings window exposes both color groups
and eight endpoints; actual native light/dark gallery captures were inspected.
This is a local update package, not a new public release. Only the disposable
test-vault installation was updated; formal personal-vault files were untouched.

## 0.1.11

- Fix inset ordinary card borders at the lower corners. Normal, selected and
  drop-target cards now share one outside, zero-blur stroke around the exact
  surface curve, including at fractional zoom. No overlapping second ring.
- Lock the card geometry in `AGENTS.md`, `docs/CARD_GEOMETRY.md` and a mandatory
  build-time CSS contract test. Add host-style regression coverage for normal
  borders as well as selection, all four corners and zoomed/stretched cards.
- Preserve card dimensions, covers, gradients, shadows, icons and interactions.

Verified locally: 65 automated tests and production build; 648 geometry cases
pass with installed Obsidian CSS in Chromium and 648 in native Obsidian 1.13.7.
The old 0.1.10 CSS fails the new contract. Native 60-card full-surface layout
checks show zero top/bottom gaps; selection, blank cancellation and marquee
integration checks pass. Actual native light/dark renderer captures were
inspected for ordinary and selected cards, including both lower corners.
0.1.11 is a local fix package; the public release remains 0.1.10 until published.

## 0.1.10

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
