# Challenger Hub — Nexus UI 3.2.0

**Status:** Third, experimental visual direction for review only. Based directly on Observatory 3.0 (draft PR #8), not on Signal Field 3.1 (draft PR #9). Keep the three alternatives independent. Do **not** merge or deploy without an explicit design/release gate.

## Rationale

Observatory 3.0 addressed redundant navigation but remained a recognizable SaaS dashboard. Signal Field 3.1 attempted a more visually bold editorial art direction but still behaved like a graphical catalog page. Nexus 3.2 uses a different model altogether: **the user operates a spatial research instrument, rather than reading a hero and scrolling through ornamental panels**.

## Interaction architecture

- One narrow navigation rail for **Discover, My toolkit, Updates, Activity**. No floating queue button; no second access path to Activity.
- Discover opens a **live topology**: 17 orbiting buttons for the actual discipline groups, with real project counts from `state.apps`, around the central **Everything** node. Clicking a field reuses the existing application filter semantics; the center selects all domains.
- Domain nodes preserve access to source-linked project inspector actions rather than authorizing new installations. Visual linework is decorative, but node positions and counts are deterministic from the catalog.
- At mobile widths the topology becomes a category matrix with an explicit control to reveal all 17 fields. All buttons remain keyboard accessible.
- Right research desk: a real repository-linked daily pick plus four actual latest *reported* project release dates, not verification guarantees. Clicking a release row opens that source project in the catalog.
- Below the map, a compact professional **list view** is the default; users can still switch back to grid. Source warnings, installation status and approval rules remain visible.
- Appearance can be dark or light; decorative animations comply with reduced-motion preference.

## Source integrity and constraints

- Full index observed at testing: **164 projects** (12 managed + 152 independent) across 17 domains.
- **73** research-candidate-unverified projects remain non-installable; no adapter or policy changes.
- Source reported timestamps in the sidebar and release feed do **not** establish independent validation. The real source-check warning is preserved.
- Exactly three UI runtime files differ from the v3.0 design: `index.html`, `app.js`, `style.css`. No modifications to local server, update worker, source scanner, installer adapters, code signing or project registry.
- Each host's CSS was built on its own platform-specific baseline; do not deploy Windows CSS to Mac.
- User-visible tool/window actions have **not** been exercised against staging because all non-read requests are blocked.
- The older hidden DOM nodes are kept for script compatibility, not visible duplicate navigation. Removing them will require separate parity review.

## Review staging (each device-local)

| Host | Preview | Stage directory |
| --- | --- | --- |
| MacMiniOffice.local | http://127.0.0.1:17950/ | `/Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center/NexusCandidate-v3.2.0` |
| Chris Windows | http://127.0.0.1:17950/ | `D:/Velvet/Installers/CraftSuite/Center/NexusCandidate-v3.2.0` |

The local preview permits GET/HEAD only (non-read actions return 405). **Production UI 2.7.0 remains unchanged** in files on both hosts. The existing local 3.0 preview is on port 17948 and 3.1 is on 17949. Avoid mutating backend or restarting services as part of visual exploration.

## QA evidence and outstanding issue

- 44 Node.js regression tests **passed**, including seven Nexus-specific UI tests and existing scanner, source, installer authorization and queue-history guards.
- Mac Chromium/Edge smoke tests exercised dark/light UI, all 164 source-derived results, node selection (3D & CAD -> 28), Everything reset (-> 164), release feed and mobile matrix disclosure (seven visible buttons -> all 18 controls); no browser JS errors or mutating network requests.
- Source/backend/installer data files preserve their SHA-256 baseline on Windows; source-of-truth backend remains v2.5.7 where reachable.
- **Transient Windows backend interruption (recovered):** During initial testing, Chris's local `http://127.0.0.1:17873/` API stopped listening, causing the read-only 3.2 staging proxy to return 500. The service recovered later **without any assistant restart or system change**. Final Windows Edge/Puppeteer QA then **PASSED all ten responsive widths**, with 164 live catalog results, 12 managed/152 independent, zero available local updates, no JavaScript errors, zero mutating requests, no horizontal overflow and all eight protected files unchanged. The brief earlier outage should still be investigated separately, not passed off as a UI fix.
- Mac test captures under `docs/previews/nexus-3.2.0/README.md` are browser screenshots from live Mac device data, not Windows proof.
- **Full Mac Edge/Puppeteer QA PASSED** on ten responsive widths (1760, 1590, 1300, 1150, 950, 810, 650, 430, 360, 320 px): 164 full-index results, 12 installed, 152 independent, 12 device-specific updates, unique Activity route, global search, appearance, mobile drawer, source/progress safeguards. **Zero** console/JavaScript errors, **zero** mutating HTTP requests, **zero** horizontal document overflow and **all eight** protected baseline files intact. Both hosts have independently passed end-to-end read-only UI checks.

## Release gate

1. Review [actual before/after visual gallery](previews/nexus-3.2.0/README.md) and try the Mac staging interface.
2. Select a design direction **before** merging anything. Draft branches PR #8, #9 and the new Nexus branch must remain separate.
3. Continue observing the transient Windows API outage separately; repeat fresh read-only health and source-status checks before any release. Never fabricate cross-device state.
4. If later authorized to deploy, back up each platform's exact UI files, recheck host-specific SHA-256 baselines, confirm idle queues and API health, deploy only the reviewed UI files, and record production verification receipts.
