# Challenger Hub Operations UX — v2.5.9

**Status:** UI 2.5.9 deployed on Windows and macOS on 2026-10-10. Backend on both hosts remains 2.5.7; no installer or scanner changes were made by this UX release.

## User feedback addressed
- Cards showed no indication of currently updating or queued work.
- Stale historical 403s continued to be counted as active failures after later successful updates.
- The operations queue was accessible mostly from the footer or only when a transient progress dock became visible.
- User requested a much stronger visual design without sacrificing professional clarity.

## Features
1. Queue is permanently accessible from a dedicated Operations queue sidebar entry, a live-count topbar button, the activity dock, and the existing footer. The dialog shows Running / Waiting / Open issues metrics and a full previous-outcomes history.
2. Active card status shows the real reported phase (Downloading, Verifying, Installing, Updating). Active cards receive a mint accent border and indeterminate perimeter pulse. Waiting items show a violet dashed border and their true queue positions. Existing verified update status remains unchanged when no job is running.
3. The operations dock is permanently available: compact idle mode; expanded active/waiting mode with an indeterminate progress bar. An exact numeric percentage is **never** invented. The dock is anchored left of the catalog to avoid blocking Grid/List controls and minimizes when idle. Reduced-motion preferences suppress nonessential animations.
4. Latest terminal outcome **per app** determines whether a failure is unresolved. Later success clears a past failure from current counters without erasing the failure from history; the dialog labels such entries "Past failure · recovered".
5. Unresolved recent errors can be dismissed locally from the dock. Dismissal does not modify server history; a distinct new error alerts normally.
6. Delayed source-scan notices are informational, individually dismissible in local UI storage, and surface again if the underlying error message changes. A disconnected local service remains visibly in error and is not silently suppressible.
7. Premium styling refines accent hierarchy, card depth, status indicators, activity metrics, queue and modal surfaces; light/dark themes and mobile layouts remain supported.

## Research registry reconciliation
The original GitHub main remained at 79 research entries and backend source version 2.5.2 while both hosts had already been upgraded to 152 research entries / backend 2.5.7. This code update reconciles **only the six reviewed production source files**: app.js, index.html, style.css, server.js, source-scanner.js, challengers.json. It preserves all installer and approved adapter source files unchanged.
The additional 73 entries remain research-candidate-unverified, with installAdapter=null and installable=false. An unverified upstream release signal cannot become installer authorization. Source scanning retains a fair single queue for 164 projects plus one ordinary directory-discovery slot.

## QA evidence
- Staging Chromium/Edge browser QA on Windows and Mac, eight viewport widths 320–1760 px each: PASS, no JS errors/horizontal overflow.
- Production browser QA on both platforms, four widths 320/430/900/1590 px: PASS; no mutating HTTP requests during tests.
- Browser-only synthetic queue scenarios validated active and two pending positions, working/queued card CSS states, accurate queue metrics, and that progress omits aria-valuenow when worker provides no percentage.
- Historical error followed by success no longer counted as open. Dismiss current failure, preserve history, show fresh failure; follow-on success resolves it. Dismissed scanner warning stays hidden until its content changes.
- Tested open/close queue from toolbar and sidebar; Grid/List controls and app inspector remain functional.
- No background installation/update executed by this UX patch. Real production backend/files were preserved through SHA-256-verified three-file deployment and per-platform rollback.

## Rollback
- Windows: D:\Velvet\Installers\CraftSuite\ChallengerHub-UIRollback-v2.5.9-windows-20261010
- macOS: /Users/chris/Library/Application Support/OfficeOps/CraftSuite/ChallengerHub-UIRollback-v2.5.9-mac-20261010
- Live receipts: each rollback directory /deploy-receipt.json; production browser QA: Center/_qa/operations-ui-production-2.5.9/operations-ui-qa.json.
- Staging scripts and test snapshots remain local to each host, not published in the production app or repository.

## Platform parity and runtime boundaries
The two hosts share the same production app.js, server.js, challenger-core.js and research registry hashes. macOS retains its existing platform-specific CSS additions and an earlier source-scanner implementation; Windows hosts the bounded Atom-prefix optimization represented by this repository branch. Both hosts passed UI QA and scan equal-priority assertions, but source-scanner code parity remains a separate, reviewed deployment. A fresh git checkout intentionally has no installed-app/runtime cache: do not treat a blank first-launch installed count as a source-code regression, and do not copy runtime state into git.

## Boundaries
No new install permissions, no API write actions, no scanner priority exceptions, and no fake percent-complete states. Backend history continues to exist; acknowledgement of UI notices is user-local and reversible when warning content changes.
