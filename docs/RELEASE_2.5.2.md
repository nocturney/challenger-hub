# Challenger Hub v2.5.2 — verified production release
Date: 2026-10-10 | Repository: nocturney/challenger-hub (Private)

## Versioning and deployment
- Source commit: ea5f614330c301e7437ad42fef6d63989e63ffa7 (feature implementation); release documentation committed later.
- Baseline: main tag v2.5.1 (the previous production), promoted after cross-platform acceptance.
- Production: 2.5.2 live on Windows Chris and MacMiniOffice.local.
- Runtime paths: Windows D:/Velvet/Installers/CraftSuite/Center; macOS ~/Library/Application Support/OfficeOps/CraftSuite/Center.
- Live address: http://127.0.0.1:17873 on each host, localhost only.
- Only five runtime files changed: app.js, server.js, challenger-core.js, source-scanner.js, sources.json.

## Behavior
- 91 equally prioritized release-monitoring entries, plus one nonprivileged owner-directory discovery task.
- Default 12-hour due interval, optional 6 or 24 hours, one task about every 20 seconds.
- Verified sources: GitHub Atom, GitLab, KDE Invent and Codeberg, with conditional HTTP and host-specific backoff.
- Capped changed-release GitHub API verification: at most 8 attempts per hour per device.
- Nonverified mirror tags are not published releases and cannot authorize installation.
- Upstream signals are visible in product details; raw research/curation filenames remain hidden from end-user API.

## Quality gates completed
- Unit tests: 4 of 4 passed independently on Windows and macOS.
- Candidate browser tests: 7 responsive viewport sizes per platform, 0 page errors, 0 horizontal overflow.
- Live production browser tests: 7 responsive viewport sizes per platform, 0 page errors, 0 horizontal overflow.
- Global search bypasses filters and restores them when cleared; styled accessible dropdowns preserved.
- Package allowlists, Install-Challenger.js, adapters.json and portable-assets.json are SHA-256 identical to v2.5.1.
- 12 Craft apps plus 79 independent challengers; 7 approved independent installers Windows, 6 Mac.
- Zero active/queued installations on deployment and final acceptance.
- Staging listener 17876 stopped on both devices after deployment to avoid duplicate source checks.

## Backups and rollback
Windows backup: D:/Velvet/Installers/CraftSuite/ChallengerHub-ScannerRollback-v2.5.1-windows-20261010
Windows utility: D:/Velvet/Installers/CraftSuite/ChallengerHub-ScannerSafeDeploy-v2.5.2.js
Mac backup: ~/Library/Application Support/OfficeOps/CraftSuite/ChallengerHub-ScannerRollback-v2.5.1-mac-20261010
Mac utility: ~/Library/Application Support/OfficeOps/CraftSuite/ChallengerHub-ScannerSafeDeploy-v2.5.2.js
To restore: FIRST verify no installer/download jobs, stop the specifically identified local production server;
run the utility on that machine with the argument rollback; restart using the existing Start-Center.ps1
or CRAFT_NO_BROWSER=1 Start-Center.sh. The utility verifies file hashes and removes the newly added source-scanner.js.
Do not restore mutable managed-installs.json, release-index.json, catalog-cache.json or source-signals.json.

## Remaining limitations
- Polling is incremental. With 92 slots at ~20 seconds each, the first full pass takes roughly 31 minutes.
- Caches and API budgets are per computer; the two machines do not share one global polling cache.
- Only manually verified alternate repositories are trusted. Additional mirrors need provenance checks.
- Published releases, Git tags, and repository heads are distinct and may be temporarily out of sync.
- Native wrapper applications were neither repackaged nor signed again in this release.
- The macOS GitHub CLI was not authenticated at release import time; do not copy Windows credentials to it.
- Outstanding catalog work: four icon identities and seven software-comparison mappings remain to verify.

## Audit artifacts
Each machine: Center/ScannerCandidate-v2.5.2/_qa/scanner-stage-qa.json
Each machine: Center/_qa/scanner-v2.5.2-production/production-qa.json
Each machine: parent CraftSuite ChallengerHub-ScannerDeployPayload and ChallengerHub-ScannerRollback manifests.
Original Google Drive handoff retains project history and should be updated with the current release summary.
