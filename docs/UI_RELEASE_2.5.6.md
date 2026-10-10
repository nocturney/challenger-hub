# Challenger Hub 2.5.6 — honest card actions and visible Update all

## User problem
- The three-dot icon shown on each Grid card implied an overflow menu, but it simply invoked the same Details view as clicking the entire card.
- Update all already existed in the distant main footer. It was easy to miss from the Updates tab and gave no visible indication of the number of eligible, approved packages.

## Shipped UI behavior
1. Remove the redundant Grid card ellipsis from the generated markup. Cards remain focusable and clickable for inspector details (mouse or keyboard), with a clear click tooltip and focus-visible outline. Primary action buttons retain their separate install/open/details semantics.
2. Move the existing Update all button from the global footer into a dedicated panel immediately above application results, shown only while the Updates status scope is active. During global search, which overrides status scopes, the panel is hidden to avoid misleading batch semantics.
3. Display the live count of currently eligible, source-verified installable updates. Separately describe any updates that lack an approved installation adapter; these cannot be queued.
4. Disable Update all when no eligible update exists, while installation/download activity is ongoing, or if the Windows service lacks administrator privileges.
5. Before invoking the existing /api/update-all route, require explicit confirmation including target application names, count, sequential execution and the verification requirement. The server remains authoritative and queues only needsUpdate && installable.
6. Preserve responsive layouts, native installation checks, progress updates and per-OS backend versions.

## Scope of code changes
app.js, index.html, style.css only. The server, source-scanner, managed update system, installer adapters, digests and release metadata are not modified.

## Verification
- Windows and macOS staged browser tests at 1760 / 1590 / 1250 / 900 / 650 / 430 / 360 / 320 pixels passed with zero JS errors and zero horizontal overflow.
- All scope counts remained All 91 / Installed 12 / Updates 12 / Discoveries 79 / Not installed 79. Each host reported 12 eligible Craft software updates at the time of the test.
- The Update all button appears only in Updates view, displays a count of 12, shows a descriptive confirm dialog and does not issue a request on Cancel.
- A successful confirmation was tested with the /api/update-all POST INTERCEPTED and MOCKED inside the browser. No real update/install request reached either host.
- Tested guard states (active/queued, Windows non-admin), opening/closing inspector from a card, search hiding/restoring batch CTA, and full installer/source-core hash invariants.
- Live production QA repeated on both systems, using the same mocking, and production package hashes match staged files.

## Release and rollback
UI v2.5.6 has been installed through a verified 3-file promotion; backed up separately on Windows and macOS. Backend runtime versions remain Windows 2.5.3 / macOS 2.5.2.
Windows backup: D:\Velvet\Installers\CraftSuite\ChallengerHub-UIRollback-v2.5.6-windows
Mac backup: /Users/chris/Library/Application Support/OfficeOps/CraftSuite/ChallengerHub-UIRollback-v2.5.6-mac
Per-host deploy/rollback tool: ChallengerHub-UISafeDeploy-v2.5.6.js under each CraftSuite parent folder.

## Do not
- Trigger actual bulk updates as part of UI regression testing.
- Treat a source tag or unverified alternate project as an installable update.
- Conflate UI version 2.5.6 with the backend scanner version.
