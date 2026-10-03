# Mobile support in 0.1.19

Targets: current supported Obsidian on iPhone/iPad (iOS/iPadOS) and Android
phones/tablets, minimum app version 1.13.7. Not every historical OS/WebView.
The manifest allows mobile loading; that alone is not mobile acceptance.

## Interaction contract

- Desktop: unchanged single-click selection, double-click open, native menus,
  modifier/range selection, HTML drag adapter and native leaf history.
- Mobile: tap opens. Hold 550 ms (or the native hold menu) enters selection and
  opens actions. Subsequent taps toggle selection. Blank tap/Escape/Clear
  selection exits. Selecting a new folder destination resets transient mode.
- Move selected items: choose a vault folder, then Move here; check the whole
  batch before writes and revalidate the target/items at write time. No
  overwrite, arbitrary external paths or invalid descendant targets. Partial
  writes are reported and are not automatically reversed.
- Delete still acts on the pressed item and respects native confirmation and
  trash preferences. Multi-select menus omit Rename. No Finder/Electron on
  mobile, including hosts that do not export FileSystemAdapter.
- Scroll/pinch never prevented on pointerdown; movement >10 px, additional
  pointer, cancellation and scrolling cancel a hold. Long holds suppress the
  trailing click. Refresh/close disposes timers and pending targets.
- Exactly Create, Sort, Filter in the header; mobile touch targets 44 px where
  pane space allows. No fourth header control or translated width sizing.

## Thumbnail compatibility

DataAdapter-backed local cache, not Node filesystem access. WebP/PNG format
and extension match actual encoded bytes. Old WebP indices remain compatible.
Cleanup permits only owned hashed filenames inside each cache directory.
HTMLImageElement is a fallback for missing/failing ImageBitmap, including SVG
and nested-Canvas previews; Blob URLs stay alive until drawing, then revoke.

Mobile Canvas: one concurrent job, max dimension 1024, nested depth 1.
Desktop settings: unchanged 2/1600/2. Mobile PDF max dimension 900, desktop
1200. Worker source remains local, with missing API shims and bounded startup.
Worker initialization failure does not prevent loading the gallery. There is
no remote import/eval fallback. PDF.js and all licensing notices are retained.

## Evidence

- Production build passes 300 tests in 21 suites, including existing
  card/layout/history/event/menu/settings assertions, mobile gestures,
  translations, MIME/cache, decoding and worker failure tests.
- Private Chromium checks: actual minified production main.js
  loaded with only the Obsidian host import allowed; no Node or Electron.
  Host APIs are fixture substitutes and files live only in memory. Real
  Canvas and bundled-module-worker PDF rendering, missing Promise APIs,
  HTML decoder fallback, tap/hold/scroll/multi-selection/move behavior and
  320/375/390/430/768/1024 px layouts passed. This is Chromium, not WebKit.
- Host CSS regressions: 648 outline cases including fractional heights,
  widths/zoom/metadata/themes and hover/focus; 864 layout, 216 sparse,
  1080 localized toolbar state and 384 responsive cases passed.
- Card markup structure and styles.css are unchanged. Only the draggable
  attribute and event logic vary on mobile. Card-geometry assertions unchanged.
- Android emulators running official Obsidian 1.13.8 pass phone/tablet
  integration: enablement, local Canvas/image/PDF previews, native menus,
  multi-selection/batch moves, 18-language settings, collision prevention,
  deletion cancellation, cache cleanup/rebuild, offline process restart and
  both orientations. Real-host card geometry passes 648 cases per device.
  Light/dark and orientation screenshots were inspected. Test vaults contain
  only generated files; personal notes and settings were not modified.
- iPhone/iPad simulators running native WKWebView pass production-runtime
  Canvas/PDF PNG rendering and touch-logic fixtures in light/dark. Obsidian
  APIs/storage are substitutes; this is NOT iOS Obsidian E2E.
- The opaque about:blank browser fixture cannot start even a trivial Blob
  worker. A loopback-only isolated HTML origin fixes that fixture limitation;
  renderer failures were not dismissed or replaced with mocked PDF output.

## Remaining acceptance

Run on real iPhone, iPad and Android phone/tablet: enable/install, relaunch,
image/Canvas/PDF previews, local resource paths, offline cache/rebuild/prune,
long-press versus scrolling, multi-select/move/collision/cancel, creation,
native deletion confirmation, sort/filter, orientation, touch keyboard,
18-language settings, safe-area/sidebar layout and native back navigation.
Use disposable vaults; preserve settings and original notes. Hardware/OS
differences cannot be certified by browser device metrics or synthetic events.
Emulator checks are not universal device certification. Older OS/WebViews,
assistive input, physical back buttons and large-vault memory pressure still
require independent validation.
