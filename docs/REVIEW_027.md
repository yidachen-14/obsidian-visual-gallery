# Community review remediation — 0.1.27

Status: local candidate validated on 2026-10-28. This is not a new Community review result. The published listing still needs a new release and automated review.

## Actionable source findings

The production build now gates the specific review rules with ESLint (including the Obsidian plugin's rules). All of those source rules pass with zero errors/warnings. This does not claim that every possible lint rule has been enabled.

- Settings return seven native definition groups with searchable names/descriptions. Custom icon radios and paired gradient controls use supported `render` callbacks. Language changes call `update()`, refreshing translated definitions without resetting appearance. Deprecated dynamic tooltips are removed; native slider values remain visible.
- Native element/fragment/SVG helpers preserve detached rendering canvases and each parent's document. Host methods are bound when extracted. Electron is obtained only through the desktop host's optional loader, keeping mobile module loading safe. Timers use window APIs.
- Saved configuration is treated as unknown and checked before use. Redundant assertions and the unused Canvas type are removed. Invalid filename control characters remain rejected, without a control-character regex.
- The list divider retains its ordinary-shadow fallback and color-mix override in a separate feature-support block. Card geometry and selection behavior are unchanged.

## PDF build boundary

`scripts/build/pdf-local-only.mjs` audits the pinned PDF.js 5.4.624 source at build time. Both modules replace global fetch/XHR and PDF.js's own Worker fallback with explicit denial functions. Dynamic module imports are denied, the eval capability probe returns false, and PostScript uses the existing interpreter instead of dynamic compilation. WebAssembly globals are removed from these modules. Visual Gallery creates its own embedded local Blob worker outside this library boundary. No host/global networking or execution API is modified.

The build fails if the audited upstream eval/import/compiler shapes change. AST checks on both transformed modules reject callable fetch/XHR/Function/eval/Worker globals, dynamic import expressions and WebAssembly references. The shipped denial functions are also exercised directly. PDF options still disable worker fetching, WASM and eval. The PDF cache renderer key increments so previous cache entries are regenerated.

Base64 remains for local binary conversion, including older WebView compatibility. Vault enumeration remains necessary for browsing and rebuilding previews. Upstream optional WASM filenames may still be visible to static scanners, but no WASM file is shipped or enabled. The Community service's unavailable malware/obfuscation/network scans cannot be enabled by this plugin; their absence is not a successful scan.

## Release provenance

`.github/workflows/release.yml` builds tag source using the frozen lockfile, checks version agreement, attests the exact three runtime files and creates an unpublished release draft containing those same files. An existing release causes it to stop, preventing asset replacement. The workflow has not yet run on GitHub for this candidate, so attestations must not be reported as already issued.

References: [GitHub's attestation action](https://github.com/actions/attest), [release workflow](../.github/workflows/release.yml).

## Verification

- Production build: targeted ESLint gates, TypeScript, 584 tests across 44 workspace suites, plus two PDF policy checks pass. A separate offline, frozen-lockfile install and clean build pass all 409 Gallery tests and reproduce all three runtime files byte-for-byte. Local Node is 24.22.1; the configured GitHub Node 22 job has not run for this candidate. The unrelated mind-map plugin accounts for 175 of the workspace tests; Visual Gallery has 409 tests across 28 suites.
- macOS Obsidian 1.14.4 in an isolated profile/vault: typed native settings search and trusted result click locate Title font size; Traditional Chinese definitions and visible search results include 標題字級. All seven headings, 20 icon choices and eight independent color inputs remain. The native font slider responds to trusted keys. Language change uses a DOM change event on the actual dropdown and retains appearance. Test preferences are restored.
- Native PDF first-page render with local text, an RGB image, a Type 4 PostScript gradient and a remote URI annotation: 640×480, fresh render and cache reuse pass. Candidate and 0.1.26 baseline produce identical encoded thumbnail bytes (SHA256 `4f2ce17b307bca98651acceb83779e134edff76d9caa5f0beae76ea6457dea0d`). Main-renderer CDP observes no HTTP requests during this comparison; worker networking is separately denied by the build policy. This is a synthetic fixture, not proof for every PDF.
- Native desktop integration: three modes, all four column sorts in both directions, real file-open recency, 12/14/22px titles, metadata, reload, selection and narrow panes pass. Sidebar pointer/keyboard, disclosure, counts, native menus, favorites, single-click and double-click regressions pass. Trusted external Files/ directory drops in grid preserve original/imported bytes and native collision naming. These are not physical Finder gestures or hardware tests.
- Real-host CSS fixtures: legacy 648 and Craft 5,832 cases pass with zero geometry failures, including both themes, six widths, fractional heights, 125%/150% zoom, mixed titles and metadata on/off. These remain fixtures, not application E2E. Native screenshots of grid/masonry/list in both themes were visually inspected in ordinary/selected/hover/focus/drop states, including all four card corners and bottom corners.
- Evidence: local `artifacts/gallery-0.1.27-build.log`, `-pdf.json`, `-geometry.json`, `-native.json`, `-states.json`, `-settings.json`, `-pointer.json`, `-external-drop-grid.json` and screenshots. These generated artifacts are excluded from public source.

No new iOS/Android Obsidian, physical-device, Windows, published-asset attestation or official review result is claimed.
