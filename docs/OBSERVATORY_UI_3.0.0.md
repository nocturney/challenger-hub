# Challenger Hub 3.0.0 — Observatory architecture

**Status: DESIGN CANDIDATE / REVIEW ONLY.** No production rollout, no backend changes, no software installation/update, and no service restart.

## Why 2.7 needed an architectural reset

The previous interface repeated the same destinations across unrelated surfaces. The queue had four entry points (sidebar, header, footer and floating dock). Installed and Updates were clickable in the sidebar, hero, and catalog status chips. Explore/Catalog Focus introduced another set of pseudo-destinations. Source status was displayed twice. Too much attention went to opening the catalog and not to actually working with it.

## One destination, one job

| Destination | Content | Contextual operation |
| --- | --- | --- |
| Discover | All 164 records, daily real-source project, alternative comparisons, 17 disciplines, catalog facets | Inspect a project, filter inside discovery |
| My toolkit | 12 installed tools and actual version/release/launch data | Verify installed versions |
| Updates | Local update candidates and vetted packages (counts differ by host) | Check release sources; explicit update confirmation |
| Activity | Running jobs, waiting queue, outstanding issues, real history including recovered failures | Review activity, not another queue modal |
| Settings / About | Preferences and factual product information | Change appearance or release-check policy |

Activity is now a full, dedicated first-class page. The only visible Activity/queue entry is in the main sidebar. The older queue modal is left in static markup for compatibility but has no redundant visible access button.

Inside Discover, chips only narrow the Discover catalog (All, Independent, Not installed). They do not copy My toolkit or Updates. Former hero counter buttons and duplicate source-status header are removed. A source warning remains visible when data is genuinely stale.

## A fundamentally different visual language

The new Observatory interface combines ink-dark architectural navigation, oversized editorial typography, soft mineral-blue and aurora-teal gradients, original CSS orbital geometry (no external images), polished consistent product cards, contextual device banners and an entirely separate operations dashboard. A dark sidebar persists even in light theme for reliable contrast. Appearance is located in Settings rather than the top bar. Mobile navigates through a single drawer and has dedicated responsive compositions.

## Staging and trusted runtime

- Baseline UI 2.7.0 / backend 2.5.7, both authorized Windows Chris and MacMiniOffice.local.
- 12 managed + 152 independent = 164 total; 73 unverified research candidates cannot be automatically installed.
- Windows candidate: D:/Velvet/Installers/CraftSuite/Center/UIArchitectureCandidate-v3.0.0
- Mac candidate: /Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center/UIArchitectureCandidate-v3.0.0
- Preview on EACH computer: http://127.0.0.1:17948/ ; this local test server only accepts GET and HEAD (all mutating requests rejected 405).
- Current Production on EACH computer: http://127.0.0.1:17873/ ; **still UI 2.7.0**.
- Exactly three runtime UI files changed: app.js, index.html, style.css. No server, installer, scanner, adapter, catalog or registry edits. The Mac candidate was built from its own original Mac CSS and must never be replaced with Windows CSS.

## Quality gates completed in staging

Edge/Puppeteer on both hosts across ten widths: 1760, 1590, 1300, 1150, 950, 810, 650, 430, 360 and 320 pixels. Tests validate real catalogs, separate device-specific update counts, singular navigation, Discover/Toolkit/Updates/Activity, search, category filters, settings and mobile usability. Zero browser JS errors, zero mutating HTTP calls, zero overflow, zero clipped competitor labels. Eight protected backend/source/installer/catalog files retain exact Production SHA-256.

Node unit regressions cover source tracking, hash verification, current-job queue states, recovered failures, architecture, source of truth and research-only safeguards.

## Pre-release design review (not optional)

1. Review Discover, My toolkit, Updates, Activity, theme differences, mobile, typography and information hierarchy in read-only staging. Preview screenshots are stored in docs/previews/observatory-3.0.0/.
2. Rework anything that does not meet the desired visual standard; do not merge or deploy just because tests pass.
3. Upon user approval, prepare separate Windows/Mac backups, verify SHA-256 live baselines, ensure queues are idle, stage host-specific UI only, verify production browser tests and log signed deploy receipts. Preserve backend 2.5.7 and all installer approvals.
4. Keep the outstanding one-source retry warning visible. Do not pretend a UI project fixes the source scanner. Retain the original hidden queue modal only for compatibility; evaluate later safe removal in a dedicated follow-up.

**This project is a draft/design review, not permission to deploy or install software.**
