# 0.1.17 toolbar scope

The explicit merge request supersedes 0.1.16's five-button header. Keep the
folder title and exactly three icon-only buttons: Create (+), Sort, Filter.
The plus button opens the same native creation menu as the blank-space context
menu: New note, New Canvas, New folder, in that order. Opening the menu must not
create anything; a chosen action opens the existing naming modal.

Keep translated tooltips and accessible names, native Menu positioning and
keyboard operation. Preserve all sort/filter options and current checkmarks.
Size the toolbar from its actual button count. Do not change card DOM/CSS,
geometry, gradients, selection, drag behavior or naming/collision validation.

Regression gates: production build, toolbar/menu/gallery-events tests, shared
host-CSS layout fixture and `scripts/check-toolbar-017-browser.js`. Browser
fixtures verify responsive rendering and button dispatch, not native Obsidian
application E2E. Historical five-button evidence must not be presented as proof
for the new three-button header.
