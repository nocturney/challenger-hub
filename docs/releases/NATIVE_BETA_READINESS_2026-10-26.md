# Challenger Hub — Native beta readiness

**Evidence date:** 26 October 2026. **Canonical repository:** [velvet-workspace/challenger-hub](https://github.com/velvet-workspace/challenger-hub). **Target:** `release/preview11-modern-app`. Baseline before this update: `a931b07af08af08c4c3b288d5d01c87056a9b124`. This is an **internal developer-beta candidate assessment**, not a production installation, a public GitHub Release, or an approval to redistribute images.

## Purpose and explicit non-goals

The selected application is native Rust/Slint over the read-only Preview12 Node sidecar, **not** the older Windows-only WebView2 Preview11 binary. It carries 181 source-linked entries (14 managed + 152 curated + 15 research-only), and a bundled version-pinned Node runtime. No automatic installer, network telemetry, cloud AI, local document ingestion, scheduled scan, or publishing. Its operator-only Scout is separate from the running UI.

## Acceptance ledger

| Check | Current evidence | Disposition |
| --- | --- | --- |
| Native integration | PRs #35 and #37 merged into the preview branch; last functional head `92544afbb061f2049d747375bf512e873b23e5de`. PR #38 adds only operator-only Scout files. | VERIFIED: source integration, not deployment |
| Native CI | [Run 40208345814](https://github.com/velvet-workspace/challenger-hub/actions/runs/40208345814) succeeded on Windows, macOS and Ubuntu; source attestations and portable ZIP validation. | VERIFIED at recorded head |
| Rust, Node, backend | 40/40 Rust and 20/20 Node at PR #37; read-only backend with 181 records, smoke/resize and isolated preferences. No product code changes in Scout PR #38. | VERIFIED at recorded head; re-run after code modifications |
| Native UI | Actual 820px/wide windows at 100–200% text size, light/dark/high contrast, Windows UIA/keyboard shortcuts, 200% save/reset, Hebrew-English roundtrip. | VERIFIED for named cases |
| Spoken accessibility | Genuine Windows Narrator Speech Recap included labels for Browse catalog and My Software; broad NVDA/VoiceOver and OS IME composition not certified. | NONBLOCKING without reproduced material defect |
| Portable developer builds | macOS ad-hoc signature and Windows unsigned QA ZIP verified by digest and read-only run. | VERIFIED for developer QA only |
| Third-party images/trademarks | Source, SHA-256, attributions and media gate documented; complete redistribution permissions are not established. | **PROTECTED: blocks public binary distribution** |
| Public publisher identity | No Windows Authenticode publisher signature or Mac Developer ID/notarization. | **PROTECTED: blocks normal public shipping** |
| Live app installation | Windows: `D:\Velvet\Installers\CraftSuite\Center`; macOS: `~/Library/Application Support/OfficeOps/CraftSuite/Center`. Files exist but no deployed native version was established by this audit. | **NO DEPLOYMENT** |
| Security/usage budget | Security workflows on `main` are manual. Native PR CI can trigger for selected source changes; no automatic install/publish. | VERIFIED policy |

For practical local QA version selection and tested pointer rollback, see [Native beta versioning and manual rollback](NATIVE_BETA_VERSION_ROLLBACK.md). The selector changes only isolated QA pointers and does not update or roll back a production installation.

## QA procedure — no production mutation

Use a dedicated worktree and its approved development toolchain. Keep the source scanner disabled and the user installation profile isolated.

```sh
node tools/desktop-build/build-runtime.cjs 12
cd tools/ui-bench/slint-rust-host
cargo test --locked --offline
cargo build --locked --offline
cargo run --locked --offline -- --check-backend-only
cargo run --locked --offline -- --smoke
cargo run --locked --offline -- --qa-resize
```

For portable Windows/macOS artifacts use the last known green native CI run, verify the *exact* PR head in `BUILD_INFO.json` and compare the inner archive's SHA-256 against `SHA256SUMS.txt` before extraction. CI artifacts have limited retention and are not approved public releases. Native GUI snapshots containing third-party images must remain local, not in this public repository.

## Next release decisions

1. **Developer beta:** pin a commit, obtain identical per-platform portable QA packages, record SHA-256, OS/arch, bundled Node version and isolated user-session smoke. The existing production app must remain intact with a reversible test path.
2. **Public release:** clear individual screenshot/trademark redistribution rights *or* replace uncleared artwork with honest neutral placeholders; pass Windows publisher-signing and Mac notarization checks; audit all redistributed licenses and verify the update channel. Do not bypass Gatekeeper or SmartScreen.
3. **Practical improvements:** fix demonstrated UI/keyboard/IME faults if observed; optional full screen-reader certification is not an automatic beta stop.
4. **Branches:** leave native and legacy branches separate unless their production architecture and rollback are explicitly reviewed. Do not merge the whole experimental chain to `main`.

## Independent Concat research

The [Concat issue #13](https://github.com/velvet-workspace/challenger-hub/issues/13) is research-only; no installer adapter or automatic promotion. Source/release claims alone do not certify actual MPEG export, Hebrew captions, CLI isolation, or operator ROI.

**Evidence strength:** VERIFIED = link/test/runtime observation; PROTECTED = intentionally fail-closed permission/rights boundary; CANDIDATE = readiness requiring actual QA; REJECTED = inferring installed status from Git/CI, promising formal accessibility or shipping unlicensed imagery.

<!-- verified-archive:v1 project=challenger-hub-native -->
## Verified closeout — 2026-10-29

**Project / aliases:** Challenger Hub Native, Focus/Orbit, Preview12 Rust/Slint UX, native developer beta.

**Goal / authority:** One selected Rust/Slint Challenger desktop implementation, integrated into the existing `release/preview11-modern-app` source branch, with a controlled path to a developer beta. Canonical source and task owner: [velvet-workspace/challenger-hub](https://github.com/velvet-workspace/challenger-hub), this readiness ledger, and the already tracked issues. The prior `nocturney/challenger-hub` repository URL is obsolete following the organization migration.

**VERIFIED_DONE — source integration and follow-on fixes:**
- Selected native code (not Electron/Tauri experiments) squash-merged in [PR #34](https://github.com/velvet-workspace/challenger-hub/pull/34) on 2026-10-25, commit `0476a351e23a3c2968f61e913ed47199f745d99d`; [native CI run 40188702503](https://github.com/velvet-workspace/challenger-hub/actions/runs/40188702503) passed on Windows, macOS and Ubuntu. Original stacked drafts #26–#28 and #30–#33 were closed as superseded; their history remains available.
- Native Browse legibility [PR #35](https://github.com/velvet-workspace/challenger-hub/pull/35), adaptive text scaling to **200%** and mixed RTL search [PR #37](https://github.com/velvet-workspace/challenger-hub/pull/37), manual research-only Scout [PR #38](https://github.com/velvet-workspace/challenger-hub/pull/38), and readiness documentation [PR #39](https://github.com/velvet-workspace/challenger-hub/pull/39) subsequently merged into the preview branch.
- [PR #40](https://github.com/velvet-workspace/challenger-hub/pull/40), merged as `1e9372f549fd3134821e734db517e49b3eb579fe`, corrected migrated GitHub update URLs, verified 181-record Browse navigation, and added **isolated QA-only** selection/rollback controls. [PR #40 CI run 40349412371](https://github.com/velvet-workspace/challenger-hub/actions/runs/40349412371) completed successfully. PR documentation records 40/40 local Rust and 32/32 Node tests; these results are source-head receipts, not proof of deployed functionality.
- Git remote checked on 2026-10-29: `release/preview11-modern-app` at `1e9372f549fd3134821e734db517e49b3eb579fe`; `main` at `47d1aab9d9a81631689e46ba9b0c8b9db4d1b2f4`. Native Preview12 source integration is **not** a deployment to `main` or a public release. GitHub's manual security-workflow [PR #29](https://github.com/velvet-workspace/challenger-hub/pull/29) was merged separately into `main` after the original conversation ended.

**NEXT — exact resumption step:** Recheck current preview branch, latest CI and this ledger. Choose/pin a *specific* developer-beta source SHA and verify matching Windows/macOS portable artifacts, build metadata, SHA-256, architecture, bundled Node and safe user-session smoke. Exercise [manual QA version/rollback slots](NATIVE_BETA_VERSION_ROLLBACK.md) with **isolated** APPDATA/HOME, and record a real per-platform acceptance receipt before considering any installation or wider beta. The selector alone does not launch, install or roll back a live app.

**BLOCKED for public distribution:** Third-party screenshot/trademark redistribution clearance or approved neutral replacements; Windows publisher signing, Mac Developer ID/notarization, license and update-channel integrity review, and explicit go-live approval. `Check updates: not-published` is an allowed state, not a reason to publish a release.

**DEFERRED / not universally certified:** Full Narrator/NVDA/VoiceOver announcements and real IME composition. Prior [accessibility issue #36](https://github.com/velvet-workspace/challenger-hub/issues/36) is currently closed, but its recorded evidence does not claim complete speech/IME certification; review actual defects before making a beta-blocking claim. Separately, open [legacy web UI issue #41](https://github.com/velvet-workspace/challenger-hub/issues/41) (modal focus escape) and [issue #42](https://github.com/velvet-workspace/challenger-hub/issues/42) (About version mismatch) have their own owners on `main`; they are not evidence that the native beta itself failed.

**NOT_RUN in this archive:** A new native GUI release-candidate session, screen-reader/IME acceptance on the latest branch, real production-app installation, public release, scheduled follow-up, and a deployment audit. Prior CI and merges must not be substituted for these checks.

**Limits / refresh first:** Do not recreate closed experimental PRs, open duplicate tickets, trigger installs or publication, move native code to `main`, enable automatic updates, or claim active orchestration from this documentation. Refresh actual repo/branch SHA, outstanding issues, CI results, media rights and the QA rollback ledger on every continuation. The 2026-10-25 Google Docs UX handoff is historical unless amended with a current pointer.
<!-- /verified-archive:v1 -->
