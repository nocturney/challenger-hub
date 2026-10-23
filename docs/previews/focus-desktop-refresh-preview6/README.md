# Challenger Focus 4.0 + Orbit — Windows Single-EXE Preview 6

A **real catalog and update-scan fix**, not a redesign. Preview 5's Scan button only started release-source polling, which checked one project every 20 seconds (~55 minutes per pass), never refreshed the managed catalog and mislabelled its October 10 data as current.

## Implementation

- Actual Scan now triggers all three tasks: fresh managed app catalog, live facts on 152 curated repositories, and bounded release-source checks. Progress is visible in the app.
- Manual release-source checks run at most 3 parallel jobs with a bounded interval, conditional HTTP/ETags, host backoff and explicit retry cooldown. A historical ETag without a validated source result cannot produce a false HTTP 304 success.
- Optional existing authenticated GitHub CLI for official public API queries; anonymous public fallback remains. No tokens are bundled or logged.
- New independent repository facts are sourced via read-only authenticated GraphQL, refreshed in batches: stars, last push, archived flag and *observed* release tag. No research candidate gains install authorization.
- Snapshot seeded on 23 October 2026 and SHA256 protected inside the EXE. The review-only project membership remains the October 10 curated 152, even though its live GitHub metadata is updated.
- Newly found managed repo AniCraft is counted, source-scanned despite its mixed-case name, and labelled no published release yet rather than a network failure.
- Original Focus UI, real backend, 10 official logos and 3 genuine screenshots preserved. Windows distribution remains a **single standalone EXE** containing Node, vetted backend and .NET. WebView2 Evergreen is the normal Windows prerequisite; it extracts verified internal payload under per-user LocalAppData. No new Windows service or permanent scheduled task.

## Real verified outcomes

- **14** managed applications (previously 13) and **152/152** independent repositories verified on GitHub.
- **CADCraft:** installed 0.4.0, latest official stable v0.12.0 published 23 October 2026; flagged as needing an update, NOT installed automatically.
- **Compositor:** observed v1.5.6, 17,753 stars, source pushed 23 October 2026; remains research-only.
- Complete manual release-scan queue processed in the isolated QA environment; the one orphan-ETag case was rechecked, and AniCraft has no published release.
- Tests: real native interactive Windows process and WebView2; authenticated live backend; 10/10 responsive browser/theme QA scenarios, no JavaScript errors or external browser requests. Node unit/regression suite includes manual concurrency, stale-ETag repair, release authorization separation and original design tests.
- The Scan button is also exercised through a real browser, resulting in actual backend catalog/source/registry refresh and visible progress.
- No third-party install, update, removal or rollback was executed as part of QA. Installation end-to-end remains a Production gate.

**Only a versioned GitHub test Pre-release.** Windows only. Preview 4 on Mac and all installed Production versions remain unchanged. No merges or auto-deploy. Unsigned EXE may trigger Windows SmartScreen.

Source: `server.js`, `source-scanner.js`, `registry-live.js`, `tools/desktop-build`, `tests/focus-refresh-pipeline.test.cjs`. The release's binary SHA256 and Draft PR are recorded on the GitHub Release page.
