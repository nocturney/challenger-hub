# Signal Field 3.1.0 — alternate visual direction

**Status:** Experimental design candidate (read-only staging, second draft PR stacked on Observatory 3.0). **Not a release.** Production UI remains 2.7.0 on both hosts; backend remains 2.5.7.

## Design problem

The Observatory 3.0 design solved serious navigational duplication but still felt like a good-looking SaaS catalog: conventional hero, category chips, product cards and a separate feature module. The user asked for a genuinely more exciting direction, not another iteration of gradients, typography scale or button corners.

## Intentional design change: Signal Field

- Replace "web dashboard" framing with a **visual index / editorial field guide**. Huge, disciplined poster typography; warm paper or warm-black base; citrus-lime and energetic coral accents.
- The lead visual is paired with a **live data-driven sector map**. All 17 software domains remain accessible, sorted by real project count for quick entry. Each surface is a working filter, not decorative illustration. Select **All** to restore the complete 164-project index.
- Present the **daily discovery** as a narrow, graphic editorial strip containing a real repository-linked project and clear source/verification language.
- Remove Discover's redundant **familiar-brand shortcut buttons** and repeated catalog masthead (DOM retained hidden only for legacy script bindings), keeping navigation coherent with one place per task.
- Make the **first search result visually editorial** using an enlarged hero card; its numerical label is **result position, not a ranking**, endorsement, assessment or quality score. All cards remain sourced from the original catalog, with real availability and verification status.
- Treat My toolkit and Activity as first-class workspaces in this visual language without duplicating the queue or reinstalling software.
- Provide separate, legible dark and light palettes. Mobile uses a single navigation drawer and vertically recomposed visual units.
- Reduced-motion CSS respected; decorative graphics are CSS-only, not required external assets.

## Technical scope

Only these **UI runtime files** differ from Observatory 3.0:
- `index.html`
- `app.js`
- `style.css`

No changes to `server.js`, `source-scanner.js`, installer and source adapters, verified-signature requirements, `challengers.json`, project/source registry, update approval flow or background services. Some base JS controls are kept as hidden compatible markup rather than removed unsafely; they have no visible duplicate access points.

The UI derives its real counts from the existing backend's `/api/state`: 12 managed applications, 152 independent, **164 total**. **73 research-candidate-unverified projects remain non-installable** and do not acquire permissions through visual changes. Current source data can be cached/stale and its warning is not suppressed.

The Windows and Mac candidates were built from **their own platform-specific 3.0 UI baselines**. In particular, do **not** copy the Windows style.css directly onto the Mac in any eventual deployment.

## Real staging

- **Chris / Windows:** `D:/Velvet/Installers/CraftSuite/Center/SignalFieldCandidate-v3.1.0`
- **MacMiniOffice.local / macOS:** `/Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center/SignalFieldCandidate-v3.1.0`
- **Live-data read-only preview on EACH computer:** `http://127.0.0.1:17949/` (only GET and HEAD allowed, writes rejected with HTTP 405).
- **Existing 3.0 preview on EACH computer:** `http://127.0.0.1:17948/`.
- **Production on EACH computer:** `http://127.0.0.1:17873/`, UI 2.7.0. No production installation or deployment authorized.

## Test evidence

- Edge/Puppeteer runtime UI QA, **10 viewport widths** (1760, 1590, 1300, 1150, 950, 810, 650, 430, 360, 320) on BOTH Windows Chris and MacMiniOffice.local: PASS after the final design pass.
- Discovery shows the full 164 real entries. Local My toolkit shows 12 apps on both hosts. Updates correctly reflect each device's actual state, rather than a fabricated global number.
- Workspaces, sole Activity navigation, sector map, advanced facet disclosure, global search, theme switch, mobile navigation, contrast/overflow, error/queue safeguards all exercised.
- **44 Node regression tests PASS**, including 7 design-system-specific tests and existing source-integrity/release-resolver checks.
- No browser JS errors, no mutating HTTP requests, no overflowing document, no clipped competitor details in QA. Eight protected production/source files checked by SHA-256 on each device.
- Cold clean mobile startup at 320 and 360 CSS px loaded the full 164-card catalog within ~3 seconds on the Windows test host. Earlier repeated resizes across huge DOMs caused a test-harness timeout but did not reproduce as a cold startup failure.
- A transient HTTP 500 appeared during an early macOS QA run. API health and `/api/state` recovered immediately, and a subsequent full macOS test passed. Keep this source/transient reliability observation separate from visual approval; do not claim the UI fixed it.

## Review before any rollout

1. Compare the captures in [the before/after gallery](previews/signal-field-3.1.0/README.md).
2. Inspect the 3.1 preview on BOTH computers (discover, real sector click, installed, updates, Activity, light/dark, mobile).
3. Get explicit feedback/approval for the **design direction itself**, not just a merge-ready QA result.
4. If approved later: plan a separately authorized host-by-host rollout with fresh SHA-256 baselines, backups, queue-idle checks and live-production browser QA; keep backend 2.5.7 untouched.
5. **Do not merge the stacked draft PR or PR #8 automatically.**

This exploration is a visual/interaction candidate, not a permission to take operational action.
