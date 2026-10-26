# Native beta versioning and manual rollback (developer-only)

**Scope:** `velvet-workspace/challenger-hub`, source branch `release/preview11-modern-app`. Current base reviewed 26 October 2026: `4cb596c5a1daef2354e57916c1c643d3f9f8af99`. Version checks and QA slot switching are **manual and read-only with respect to production software**. Neither source merges nor the local QA selector deploy apps.

## Separate the release channels

- Legacy Orbit/Preview12 Windows packages use `v4.0.0-orbit-preview.N` (their own format and installer policy).
- Native Rust/Slint updates accept **only** official `native-vX.Y.Z` tags, exact platform asset name and an upstream `sha256:<64 hex>` GitHub Release digest. Native manual checks must never advertise a legacy Windows release.
- The canonical owner is `velvet-workspace/challenger-hub`. Old-owner GitHub API calls return an HTTP 301 redirect. The security-bounded native updater refuses redirects; source URL and expected release asset origins **must** both be changed. Regression tests reject old-owner asset links even if redirects happen to work in an external browser.
- `Check updates` may return `not-published` while no compatible native release exists. This is **correct**; it is not permission to create one. No recurring polling or automatic install is added.
- GitHub PR CI creates **temporary developer-only artifacts** with names such as `ChallengerHubNativePreview-v0.1.0-preview12-windows-x64-<checkout>.zip`. These are **not** the canonical signed public release asset names, and must not be renamed/published without a separate rights/signing review.

## Isolated local beta slot selection

The repository provides `tools/desktop-build/native-beta-qa-slots.cjs`. It does **not** extract, download, execute, delete, install or modify a binary, user profile, running application or production folder. It selects a *manual QA launch path*, never changes an OS application registration or the updater's channel. It fails closed on wrong GitHub owner, public-releases, unpinned commits, wrong platform, missing zip, tampered zip SHA-256, symlinks and corrupt pointers.

**Initialize** a new empty directory whose leaf name begins `Challenger-Beta-Slots`. Always use an experiments/QA folder, never `CraftSuite/Center` or an existing app directory:

```sh
node tools/desktop-build/native-beta-qa-slots.cjs init "/path/to/Experiments/Challenger-Beta-Slots"
```

For each candidate, place its **unchanged** `BUILD_INFO.json`, the exact matching unmodified ZIP and a separately SHA/source-verified extraction in `slots/<id>/`. Expected binary subpath:

- Windows: `portable/ChallengerHubNativePreview-Win/challenger-slint-rust-host.exe`.
- macOS: `extracted/ChallengerHubNativePreview.app/Contents/MacOS/challenger-slint-rust-host`.

Before trusting the extracted executable, do the platform's normal checksum/signature checks and do not bypass OS security. The QA selector validates the ZIP digest, not the extracted contents or trusted publisher identity.

```sh
node tools/desktop-build/native-beta-qa-slots.cjs verify "/path/to/Experiments/Challenger-Beta-Slots" <id>
node tools/desktop-build/native-beta-qa-slots.cjs activate "/path/to/Experiments/Challenger-Beta-Slots" <id>
node tools/desktop-build/native-beta-qa-slots.cjs status "/path/to/Experiments/Challenger-Beta-Slots"
node tools/desktop-build/native-beta-qa-slots.cjs resolve "/path/to/Experiments/Challenger-Beta-Slots"
```

The `resolve` command prints the exact candidate binary path and version; it **does not launch** anything. The operator can then run a smoke test using the already verified portable package in an isolated HOME/APPDATA (for example `--check-backend-only`, `--smoke`, `--qa-resize`). Never run against a real installed app/profile without explicit product deployment approval.

**Rollback:** first close the **QA process only**, then execute:

```sh
node tools/desktop-build/native-beta-qa-slots.cjs rollback "/path/to/Experiments/Challenger-Beta-Slots"
node tools/desktop-build/native-beta-qa-slots.cjs resolve "/path/to/Experiments/Challenger-Beta-Slots"
```

The selector atomically switches its local pointer to the previously verified slot. It keeps both slot folders intact; it does not restart, uninstall, migrate or restore any real application data. No previous slot, missing archive, unexpected SHA, locked transaction or malformed state → **refuse rollback** instead of claiming success. If power fails during a selection, inspect the QA root's `selection.lock`/`selection-next-*.json` first; never blindly remove a lock while another process is operating. Real installation crash-recovery is a separate, unsolved product feature.

## Release acceptance checklist (not automatic)

1. Pin an exact reviewed Git source commit and version (avoid branch head as a moving artifact identity). Verify CI on Windows/macOS/Linux for the exact change and selected source, including 181 authentic records, no scanner, no automatic user install, proper media provenance and read-only UI smoke.
2. Compare the upstream `BUILD_INFO.json` checkout/head SHA, channel, OS/architecture, Node version, ZIP size, the manifest's SHA-256 and the actual ZIP digest. Save a portable receipt under a QA-only path.
3. Run real logged-in Windows/macOS Native GUI: Browse, search, dossier, My software, Preferences, manual update check, and error/empty states, using a separate HOME/APPDATA. Do not equate CI headless smoke or UIA tree inspection with completed interactive acceptance.
   Windows has a checked-in, **interactive-session-only** acceptance harness at \`tools/ui-bench/slint-rust-host/qa/windows-real-session-acceptance.ps1\` (parameters \`-Executable\` and \`-OutputRoot\`). Run it only with a user logged in, on a checksum-verified portable QA bundle and a QA-only APPDATA root; not under GitHub runner Session 0. The report has individual PASS/FAIL results for Browse, search/dossier, My software, Preferences, manual updates and Activity. A nonzero error indicates failed acceptance; never convert missing accessible controls to a PASS.
4. For **internal developer beta**, preserve the previous QA slot and verified archive and test explicit `rollback` + `resolve` without editing production. Failing an optional NVDA/IME certification is not automatically a stopper absent a real material product defect.
5. For **public distribution**, first clear the right to distribute every bundled third-party screenshot/trademark (or replace uncleared art with honest placeholders), validate redistributed licenses, Authenticode sign Windows and Developer ID sign/notarize macOS, then independently verify installer/update digest, signing identity, safe recovery and actual user consent. Do not disable Gatekeeper/SmartScreen or reuse developer QA packages as public releases.
6. Deploy only after a separate approval, explicit backup/recovery strategy, checking that the original production listener and installer jobs are idle, and a rollback window. The current QA selector **is not a production release manager**.

**Sources:** `docs/OPERATIONS.md`, `docs/releases/NATIVE_BETA_READINESS_2026-10-26.md`, `tools/ui-bench/slint-node-bridge/native-updates.mjs`, `tools/ui-bench/slint-rust-host/README.md`.

**Non-goals:** merging divergent `main` and native source branches, producing any GitHub Release, refreshing a physical workstation installation, changing real installers, or claiming already-signed redistribution rights.
