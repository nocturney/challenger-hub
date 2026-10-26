# Challenger Hub

**Public source repository:** [velvet-workspace/challenger-hub](https://github.com/velvet-workspace/challenger-hub). Challenger Hub is a localhost desktop catalog for independent software alternatives. Public source availability does **not** authorize third-party media redistribution or software installation.

## Current source status — 26 October 2026

- **`main`:** reviewed legacy localhost catalog/server source with the 2.7.0 Explore/Catalog workspace UI and manual security workflows. A merge does not establish what version runs on a particular workstation.
- **`release/preview11-modern-app`:** the selected **native Rust/Slint desktop** implementation, using a bounded, read-only Node/Preview12 sidecar. It is a separate development branch, not an automatic deployment to `main` or a user computer. Its native catalog has **181 source-linked entries: 14 managed tools, 152 curated sources and 15 research-only candidates**. Research entries do not grant installer authority.
- **Native QA:** the [PR #37 cross-platform run](https://github.com/velvet-workspace/challenger-hub/actions/runs/40208345814) passed on Windows, macOS and Ubuntu. Native text enlargement up to 200%, real-window responsive layout, keyboard access, high contrast and Hebrew/English query handling have been tested. A Narrator Speech Recap confirmed two spoken button labels; this does **not** claim complete VoiceOver, NVDA, IME or accessibility certification.
- **Operator Scout:** a manual, read-only research CLI; it cannot promote catalog entries, run installations, schedule jobs, start a daemon or publish results.
- **Beta candidate:** developer-only, portable packages and reproducible test paths exist. Public Windows signing, macOS notarization and third-party media/trademark redistribution clearance are **not complete**. See [Native beta readiness](docs/releases/NATIVE_BETA_READINESS_2026-10-26.md).

## Development

Work only in an isolated checkout. Never update a running installed app by pulling Git over the production directory. Builds, green CI, Git merges, developer QA artifacts and deployments are distinct facts.

```sh
node tools/desktop-build/build-runtime.cjs 12
cd tools/ui-bench/slint-rust-host
cargo test --locked
cargo run --locked -- --check-backend-only
cargo run --locked -- --smoke
cargo run --locked -- --qa-resize
```

Native developer package recipes: [macOS](tools/ui-bench/slint-rust-host/package-macos.sh) and [Windows](tools/ui-bench/slint-rust-host/package-windows.ps1). These are QA packages, **not public installers**.

## Branch boundaries

| Branch | Purpose | Deployment |
| --- | --- | --- |
| `main` | Legacy reviewed localhost catalog/server, manual security workflows | Separately approved only |
| `release/preview11-modern-app` | Selected native Rust/Slint UI and source-verified Preview12 runtime | Developer beta QA only |

These branches diverged and must not be blindly merged or force-updated. Always check live host-specific runtime receipts before describing a production version.

## Safety, accessibility and rights

- No automatic installs, third-party product promotions, public releases or new metered API calls.
- Installer actions require a vetted adapter, exact package/source digest, explicit operator consent and verified outcome.
- Genuine project screenshots have pinned source, digest and on-screen credits. **Attribution alone does not settle media/trademark redistribution rights**; public release remains fail-closed.
- Accessibility principle: **maximum practical accessibility, minimum bureaucracy**. Fix real defects; unverified optional screen-reader/IME certifications are not automatic beta blockers. Do not advertise formal certification.
- Security Actions in `main` are manual; native PR CI has its own path-limited trigger. Git pushes do not deploy user applications.

See [native beta versioning and QA-only rollback](docs/releases/NATIVE_BETA_VERSION_ROLLBACK.md), [Operations and rollback](docs/OPERATIONS.md), [native architecture](tools/ui-bench/slint-rust-host/README.md), [integration boundaries](docs/integrations/native-preview12-20261025.md), and [media provenance](tools/ui-bench/slint-rust-host/ui/MEDIA_PROVENANCE.md).
