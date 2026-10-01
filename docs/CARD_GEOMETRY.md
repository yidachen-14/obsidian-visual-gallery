# Locked card geometry

## Regression and cause

0.1.10 placed the ordinary 1 px border at `inset: 0` with a 14 px
outer radius. Its inner radius was 13 px while the clipped content's radius
was 14 px. The lower corners could therefore show content outside the gray
line. A separate selected `::after` used an outside 2 px stroke and a 16 px
outer radius, so checking only selection missed the ordinary-state defect.

## Invariants

- Card button: no layout border or padding; `overflow: visible`.
- Surface: exactly fills card; clip once with the card's radius R (14 px).
- Preview/details: no independent rounded corners.
- Only `::before` draws the stroke. No generated `::after` outline.
- Stroke width w: normal/hover 1 px, selection/drop target 2 px.
- Stroke base inset = 0, border = 0, radius = R. A single zero-offset,
  zero-blur `box-shadow` spread w expands that curve outward. Its inner
  radius = R, outer radius = R + w; positive spread never consumes content.
- Do not replace this with a CSS border: at fractional zoom, Chromium
  quantizes border widths but not inset/radius values, breaking alignment.
- Every side uses the same width; all four inner corner curves match the
  clipped surface. Selection changes tokens, not the geometry implementation.
- Hover may change color/shadow/translation, never inset/radius calculations.
- Selected keyboard focus must not add a second overlapping rounded ring.

The outside stroke adds no layout size and does not change card widths, image
layout, titles, gradients, shadows, folder icons or file interactions.

## Verification

`pnpm run build` gates changes with the CSS contract test. This fast test
protects the implementation structure, not browser pixel rendering.

In the Obsidian developer console, evaluate `scripts/check-card-geometry.js`
and require `failures === 0`. The temporary offscreen fixtures do not write
notes/settings. Its 648 cards exercise light/dark, six widths, three zoom
levels, metadata on/off, mixed/stretched titles, and normal/selected/drop
states. Each checks four sides and four corner radii, full surface bounds,
single stroke, explicit sizing and shadows.

For Chromium QA, create one ego-browser task space, then set
`process.env.VG_QA_SPACE` to its id before evaluating
`scripts/check-outline-browser.js`. It reads the locally installed Obsidian
1.13.7 host CSS and checks the same matrix plus actual hover. Capture and
inspect both themes' screenshots. `VG_QA_EXPECT=old` permits expected
baseline failure to demonstrate the test catches the old CSS. Browser
fixtures are not a substitute for viewing the real plugin in Obsidian.
