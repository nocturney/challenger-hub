# Challenger Hub UI 2.7.0 — Catalog Focus Workspace

**Scope:** Static UI-only enhancement built on the deployed 2.6.0 discovery and 2.5.9 operations foundations.

## Motivation
A thorough visual review of the actual 2.6.0 staged screenshots found that the dual Hero, daily editorial card, comparison links, 17 category pills and always-open advanced filters can push actionable search results beneath the first screen. Users should be able to explore broadly or work rapidly without losing context, data, reliability or safety.

## New behaviors
- **Explore / Catalog focus switch.** A small workspace rail presents both modes. Explore retains the 2.6.0 contextual Hero, rotating Daily Discovery and four context-aware shortcuts. Catalog focus instead presents a compact catalog-backed summary and a safe link to today's actual daily project. It removes redundant page headline chrome in focus mode only, leaving search, category navigation, sorting, application list, inspector and queue untouched.
- **Progressive categories.** The first important categories display prominently. The explicit "Show all 17 categories" control reveals the complete list. A selected category remains shown even when the others are collapsed.
- **Progressive advanced filters.** Status pills are always available; five advanced facets can be expanded/collapsed. An active count is shown when filters are collapsed, and applied filters are never cleared by hiding their controls.
- **Local per-device preferences.** Workspace mode, categories expansion and facets expansion are saved to existing localStorage preferences. Default is Explore so existing users receive a non-disruptive layout.
- **Responsive design.** Compact 320px and 430px mobile layouts, 1590px desktop; mobile status filters scroll inside their own surface rather than forcing document-level sideways scrolling. Works in light and dark modes, preserves reduced-motion preferences.

## Credibility and safety
- Catalog counts and displayed data come from the existing `/api/state` dataset, with no invented scores or completion percentages.
- The 73 research-only candidates remain unverified and non-installable.
- Opening today's project or changing layout **never installs**, updates or schedules software.
- Permanent Operations queue, running/waiting status, historic error recovery, explicit confirmation for Update all, and Mathesar/Directus competitor wrapping remain unchanged.
- No new API endpoints, background scans or write requests are introduced by this UI change.
- Exactly three UI files are changed: `app.js`, `index.html`, `style.css`; no backend, registry, install adapter or scanner changes.

## Platform boundary
Windows and macOS use their own locally staged production bases; macOS includes independent CSS extensions. The GitHub reviewed CSS follows the Windows baseline. A release must copy only each host's own three staged UI files; never deploy Windows CSS wholesale to Mac.

## QA and release gates
- Windows and macOS isolated Puppeteer test script `ChallengerHub-WorkspaceQA-v2.7.0.js`: eight widths (1760, 1590, 1300, 1150, 950, 650, 430, 320), focus-vs-explore visibility, live counts, saved preferences, advanced facets, search and category context, inspector and permanent queue.
- Verify no horizontal overflow, competitor clipping, JavaScript errors, or mutating HTTP requests. Verify eight protected source file SHA-256 checks.
- Run repo Node unit regression suite, including `tests/workspace-ui.test.js`.
- Separate per-host SHA256 rollback backup and production deployment receipt; post-deployment browser QA at 1590, 950, 430 and 320. Confirm backend remains 2.5.7 and queues idle.

**Deployment status:** See latest independently verified operational handoff and deployment receipts. This document alone is not evidence of a live production deployment.
