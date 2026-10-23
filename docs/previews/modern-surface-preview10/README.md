# Challenger Preview 10 — Native app surface (isolated UI review)

This draft is a **visual and information-hierarchy experiment** based on the actual Preview 10 branch. It does not deploy into Production, replace Preview 10's released EXE, install third-party apps, change source scanning, grant installation permissions, or alter the 181-record catalog.

## Changed

- Keeps Orbit's sage / graphite / cream identity, three main tabs and existing native WebView2/Node shell.
- Makes the home a compact search-first application screen with 17 actual interactive discipline tiles, instead of an editorial index.
- Shows real searchable results as a two-column software-card grid on desktop and one column on phones. Cards preserve existing project buttons, icon provenance, official comparisons, source/status flags and safe navigation.
- Restructures project dossiers into a condensed identity/media panel and smaller source/evidence cards. Changes report-style headings to product-friendly labels without hiding missing provenance or installer trust conditions.
- Makes read-only network/verification/update controls a compact stable toolbar, not a large ever-changing data banner. Actual status remains in the accessible source element.
- Retains My software, Activity and the quiet Preview 10 footer.

## Real QA on Chris Windows

A fresh **isolated runtime** built from these modified sources successfully; all source-pinned media checks passed. Actual Chrome/Puppeteer browser interactions tested the home, 181 projects, category tiles, 2-column results, real Dune 3D source screenshot, project navigation, theme changes and 1100×760 / 780×540 / 430×820 / 320×700 viewport sizes.

The tested screens showed **0 JS errors, 0 browser-side write requests, 0 unexpected external browser image/network requests and 0 horizontal overflow**. Browser QA ran with a private loopback engine in disabled-auto-scan mode, and the test process terminated. It is **not yet a rebuilt native EXE**.

## Genuine screenshots

- [Home, 1100 × 760](home-1100-light.png)
- [App-card results, 1100 × 760](results-1100-light.png)
- [Dune 3D detail with authentic source image, 1100 × 760](dossier-1100-light.png)
- [Compact dark mode, 780 × 540](home-780-dark.png)

## Reproduce safely on authorized Windows development checkout

    node tools/desktop-build/build-runtime.cjs 10
    node tools/desktop-build/qa-modern-surface-preview10.cjs

The builder refuses to overwrite an existing runtime. Clean only the isolated test output from this worktree before rebuilding, and never touch a live Production installation.

## Review status

Source branch based on feat/focus-preview10-quiet-footer-genoffice (Draft PR #23). Do not merge or publish as a production update without full regression, native EXE verification and explicit promotion approval.

## Regression status

- Preview-specific Node regression suite: **54/54 passed**.
- Existing Preview10 browser QA for all 181 projects / search / new finds / footer: **passed**.
- Existing original Craft source-image browser QA: **passed** (four sampled products).
- The older tests/*.test.js suite is **30 pass / 18 fail**, unchanged on the clean Preview10 base branch. Those tests still assert obsolete pre-Focus UI and are not a newly green CI gate. Do not present the entire historical test fleet as all-green.
