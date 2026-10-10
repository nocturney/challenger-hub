# Challenger Hub · UI maintenance 2.5.4

## Scope
This release fixes the status quick filters, moves sorting into the application results region, and differentiates the selected-app inspector from grid tiles. It changes only `app.js`, `index.html` and `style.css`.

## Behavior
- All apps: full catalog.
- Installed: entries actually installed on the local host.
- Updates: installed entries with an available verified newer release.
- Discoveries: cataloged independent research entries.
- Not installed: every entry without an installed version, including research-only discoveries.
- The quick scopes are global: choosing one clears category/domain, platform, maturity, availability and creator refinements, to avoid zero results hidden behind stale filters.
- Search still temporarily overrides quick scopes and refinements; clearing a search restores the chosen scope.
- Keyboard and nested counter clicks activate buttons through event delegation.
- The sort control and Grid/List switch live directly above matching applications, not above the category/filter panels.
- In Grid view the app inspector uses a distinct dark, compact identity header and neutral specifications region. List view's existing slide-over inspector remains unchanged.

## Validation
- Windows staging based on production 2.5.3; macOS staging based on production 2.5.2. Runtime backend code is not modified by this UI release.
- Playwright-style Chromium/Edge browser QA through Puppeteer on eight widths (320–1760 px) per OS.
- Expected counts on both: All 91 / Installed 12 / Updates 12 / Discoveries 79 / Not installed 79.
- Tested nested chip activation, old-filter reset, search precedence/restoration, sorting, grid/list, light/dark themes, responsive horizontal overflow and zero JS console errors.
- Tested staging on port 17924 with automatic source checks disabled.
- Install-Challenger.js, adapters.json, portable-assets.json, sources.json, source-scanner.js and challenger-core.js retained exactly as found on each host.

## Deployment / rollback
Deploy ONLY the three static UI files after verifying existing production hashes, no active installer jobs, and making per-host rollback backups. The server reads these static files from disk on each request and does not need to be rebooted for a UI-only update.
Never use this UI version to infer backend scanner parity: Windows and macOS scanner integration are being tracked separately.

## Non-goals
No new installers, no change to source-feeds or priority, no API shape change, no external downloads or third-party package execution.
