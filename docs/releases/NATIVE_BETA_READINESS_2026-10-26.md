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
