# Challenger Focus 4.0 + Orbit — Preview 11 (Windows x64)

A new **native desktop test build** carrying the user-approved Modern App Surface design. Preview 11 follows Preview 10 and does not overwrite it.

## Improvements

- Modernized, search-first home and 17 interactive category tiles.
- Two-column software-card results on desktop (responsive single-column on narrow screens).
- Cleaner source-linked product detail views with authentic image/media and action/status hierarchy.
- Compact and stable live-status toolbar, release checking and version controls in quiet footer.
- Preserves the Preview 10 vetted **181-entry catalog**: 14 managed tools, 152 curated independent sources and 15 existing non-installable research candidates.
- Keeps actual installer/update authorization rules, truthful source metadata and original Orbit palette.
- New independent Windows user-data profile: %LOCALAPPDATA%\VelvetOS\ChallengerFocusDesktop\Preview11. Preview 10 remains unchanged.

## Package

- ChallengerFocusDesktopPreview11.exe — Windows x64, **single-file portable test EXE**, bundling Node.js and the private loopback engine. Requires Microsoft WebView2 Evergreen.
- SHA256SUMS.txt — integrity digest for verification before opening.
- Actual version: 4.0.0-desktop.preview.11.
- **Not a Production build.** No forced or automatic upgrades, no installer privilege for research entries, no scheduled background task.
- This EXE does **not** contain the operator-only Scout, private Scout evidence, candidate discovery CLI or additional unapproved projects.
- Unsigned development preview; Windows SmartScreen may display a warning. No publisher signing/notarization is claimed.

## Validation performed on Chris (2026-10-23)

- **54/54** Preview-specific Node regression tests passed.
- Browser viewports at 1100x760, 780x540, 430x820 and 320x700 in light/dark modes; valid navigation, app-card grid, 17 disciplines, real Dune 3D screenshot, no JS errors or horizontal overflow.
- Existing catalog and source-media end-to-end QA passed: 181 searchable entries, archived/incomplete sources remain visible, 15 existing New finds research-only entries, official Craft media unchanged.
- **10/10** authenticated native-package browser scenarios passed, including rejection of unauthorized installer requests.
- Every embedded Node/runtime file checked against its SHA256 manifest.
- **Actual Windows interactive first-run:** executed in ordinary user Chris console session 1, WebView2 initialized, owned local engine started, UI navigation succeeded, observed 1100x760 native window, graceful closure. The temporary one-shot test task was deleted and no orphaned app/Node process remained.
- Older legacy tests/*.test.js tests still include 18 known pre-Focus failures, reproducible on unchanged Preview 10. They are not claimed as passing.

## Reproduction (authorized development Windows host)

    node tools/desktop-build/build-runtime.cjs 11
    node tools/desktop-build/build-onefile-windows-preview11.cjs
    node tools/desktop-build/qa-modern-surface-preview11.cjs
    node tools/desktop-build/qa-onefile-windows-preview11.cjs
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/desktop-build/qa-preview11-native-first-run.ps1

The native first-run test uses a unique, temporary, on-demand task solely to enter the logged-in console session and removes it in finally. The build scripts refuse to overwrite an existing versioned build directory.

## Existing visual review

- [Modern Explore home](../../previews/modern-surface-preview10/home-1100-light.png)
- [Software cards](../../previews/modern-surface-preview10/results-1100-light.png)
- [Dune 3D product detail](../../previews/modern-surface-preview10/dossier-1100-light.png)

The screenshot paths reflect the original approved UX review but are the same underlying design in Preview 11.

## Release channel

Official prerelease tag: v4.0.0-orbit-preview.11, targeted at the isolated release/preview11-modern-app source branch. Review only; no merge to the old main branch or production.
