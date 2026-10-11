# Challenger Hub Focus 4.0 — Structural UI Concept Handoff

**Status:** Design concept for review only. Read-only, not feature-complete and not releasable. Built directly from the Observatory 3.0 source baseline, **not** a CSS reskin of Signal Field 3.1 or Nexus 3.2.

## The problem revealed by user review

The user gave three precise assessments: 3.0 was **too busy**; 3.1 was **ugly**; 3.2 was **too playful**. More importantly, the same sidebar + hero + categories + tiles + inspector survived all three iterations. Color, spacing, node maps and typographic spectacle did not change how someone actually uses Challenger Hub.

The response here deliberately **removes** that layout architecture. We are testing a new workflow before exploring design embellishment.

## Core product concept

### 1. Discover is a task, not a dashboard

Landing page displays a single prominent search input, directly usable by typing a familiar product name or a category. It also exposes one plain-text index of the 17 disciplines, with live source-derived counts. There are no default project cards or busy metrics on arrival. A small source-reported recent list is secondary, not an independent promoted feature.

### 2. Results are a workspace, not a set of cards

After an explicit intent (text search, category selection, or Find tools with an empty query) users enter an independent result route. It is a compact, sortable table with actual source names, challenged products, statuses and published dates, plus optional filters. By default only the first 30 matching projects render, with a real Show More control. Live text input narrows results. No always-visible sidebar or duplicate category navigation.

### 3. A project has a dedicated full page

Selecting a project navigates to a full document/dossier. It includes the true current backend status, summary, challenged software, project metadata, licensing, release notes or a clearly stated absence, platform and caveats when available. It exposes **only safe, allowlisted HTTPS source links**. Normal project Back and browser Back/Forward work; the dossier is not a floating catalog inspector.

### 4. Operational work is separate

A unified top-level **My software** destination includes **Installed** and **Available updates** as local tabs. A single **Activity** destination shows current worker, pending queue and timeline with historical recovery classification. This is the only global navigation: Explore / My software / Activity. Status and themes are utilities, not duplicate destinations.

### 5. Truthful read-only stage

Staging only accepts **GET and HEAD**. The independent browser frontend calls **GET /api/state only** and handles network or schema failures by displaying explicit disconnected states, not by inventing demo content. No POST, PUT, DELETE, installer, launch, scan, update or setting writes are possible in this concept. The absence of operations is an intentional proof-of-architecture boundary, **not feature parity**.

The UI is rebuilt in the three files \`index.html\`, \`style.css\` and \`app.js\`; it does not load or depend on the old \`ux-experience.js\` or shader code. The existing version 2.5.7 backend and source registry remain completely unchanged. No auto-launch of programs was tested or attempted.

## Verified dataset

- Both test hosts reported **164 projects**, comprising 12 managed and 152 independent projects.
- 17 real discipline groups, based on the existing Challenger taxonomy; selecting **3D & CAD produces 28 results** in the tested data.
- Search for **Photoshop** produced **5 actual matches**.
- My software showed 12 installed apps on both hosts. **Windows: 0** outstanding updates; **MacMiniOffice.local: 12** outstanding updates at capture time.
- 73 research-candidate-unverified entries in the underlying registry remain non-installable (source-policy files untouched).
- Existing source-check warning remained visible where a source required retry; the status was not hidden by design.

## Paths and previews

| Device | Staging path | Preview |
| --- | --- | --- |
| Chris Windows | \`D:/Velvet/Installers/CraftSuite/Center/FocusCandidate-v4.0.0\` | http://127.0.0.1:17951/ |
| MacMiniOffice.local | \`/Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center/FocusCandidate-v4.0.0\` | http://127.0.0.1:17951/ |

Existing preview 3.0 (17948), 3.1 (17949), 3.2 (17950) and production UI 2.7 (17873) remain separate. The preview URL must be opened **on the target device itself**, because the server binds only to localhost.

## Validation and limits

- Full browser QA on **both Windows and macOS**, widths **1590, 1040, 768, 430, 320** CSS pixels: PASS. Screenshots were captured from the live Windows read-only staging app and placed in \`docs/previews/focus-v4.0.0/\` with checksums.
- Verified 17 domains, 164 projects, 28 3D matches, actual Photoshop results, full-page document, correct local installed and update counts, separate activity timeline, light/dark appearance and small-screen reflow.
- **Zero browser JavaScript errors, zero non-GET/HEAD network requests, zero horizontal document overflow** after correcting the 320px header.
- Explicit browser history round trip from domain to project and Back/Forward passed.
- **10 Focus-specific unit/contract tests passed**, including navigation architecture, real data contract, outbound source whitelist, research restriction and no mutating methods.
- **Legacy production feature tests are not satisfied by this intentionally read-only rewrite.** The original installer action flows, native wrappers, settings changes, context-specific package verification, source scan controls and full keyboard navigation parity are **not yet integrated**. This branch is for design review only, not release candidate or even integration-ready feature branch.

## Source protection

Eight sensitive backend, source and installer files were SHA-256-compared against the approved Observatory 3.0 baseline and production on Windows and remained unchanged. The three frontend files are independent experimental replacements.

## Gate before any serious implementation

1. **Ask for feedback on the architecture**, not another round of palette/spacing refinements.
2. If rejected, revisit actual user workflows before producing more skins. Do not push production-facing code.
3. If selected, plan a separate architecture integration: move operational command handlers and confirmation dialogs into the new routes without duplicating destinations, restore all native functions, preserve explicit approvals, and test parity on Windows and macOS.
4. Test full accessibility/keyboard navigation and assistive semantics, installer risk boundaries, source staleness, native startup, and any operational workflow before any deployment.
5. Perform a new authorized release gate for each platform; preserve rollback options and production 2.7 UI until independently verified.

**Never merge this concept into a production/release branch on the strength of the visual screenshots alone.**
