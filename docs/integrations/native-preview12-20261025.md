# Challenger Native Preview12 - selected source integration

## Target and scope

Integrate the **tested Rust/Slint native implementation** from original draft
PRs #28, #30, #31, #32 and #33 into the existing
`release/preview11-modern-app` development branch. This branch is a
pre-release *source branch*, not an automatic production deployment.
Do not merge it into `main` or ship native binaries without separate
release acceptance.

Original PR chain: #26 -> #27 -> #28 -> #30 -> #31 -> #32 -> #33.
This integration deliberately does **not** merge the chain wholesale.
A direct merge of #33 would pull in an experimental Electron shell and
Electron/Tauri UI benchmark projects via #26 and #27.

## Included, with evidence of necessity

- `tools/ui-bench/slint-rust-host/**` - native UI, supervised process,
  packaging, genuine identity/media, local preferences, accessibility QA.
- `tools/ui-bench/slint-node-bridge/**` - bounded backend protocol, explicit
  reviewed-install guard, per-device catalog, manual native-update queries.
- `.github/workflows/native-rust-sidecar.yml` - existing cross-platform
  native build, protocol tests, read-only GUI smoke, portable ZIP verification,
  source attestation. The bridge test matrix also tests manual native updates.
- `tools/desktop-build/build-runtime.cjs` and the new Preview12
  *platform-availability* source files - required for the native sidecar's
  exact `runtime-preview12` path and truthful cross-platform badges;
  the runtime builder succeeds without the Electron shell.
- `server.js` and `platform-availability.js` - source-backed API
  response, no new installer authorization. Native availability must not
  equate platform compatibility with an approved installer.
- `Install-Challenger.js` and `portable-assets.json` - exact reviewed
  native-install worker flags, cancellation/rollback/integrity boundaries.
  This is *not* permission to perform an installation automatically.
- UTF-8 seed repairs and native checksummed-media rules in `.gitattributes`;
  security/availability regression tests.
- Native UI proof, source-media inventory/credits, and accessibility QA
  documentation from the reviewed work. Public media redistribution still
  fails closed.

## Intentionally excluded

- `tools/crossplatform-electron/**` and its packaging / legacy shell
  (PR #26): redundant alongside the selected Slint UI.
- `tools/ui-bench/electron/**`, `tools/ui-bench/tauri/**`,
  `tools/ui-bench/slint/**`, `tools/ui-bench/web/**`, and benchmark
  fixture/results programs (PR #27): comparison experiments, not
  shipping native code. Those historical PRs retain the results.
- `tests/crossplatform-shell.test.cjs`: tests the excluded Electron pilot.
- `.github/workflows/pdfcraft-native-win-qa.yml`: redundant heavyweight
  pull-request-triggered Windows install simulation. Reviewed-install
  security tests remain in the native CI; explicit disposable Windows
  installer QA can be run separately on request.
- Electron's own build and package-lock trees are not imported.
- This integration does **not** create a public GitHub Release, sign a
  distributor package or install any application on a workstation.

## Required proof for merging into the preview branch

1. Runtime 12 built from the base branch plus selected changes; 181
   reviewed catalog records and source-scoped provenance remain accurate.
2. Native source, security and visual policy gates pass, and public media
   redistribution remains **blocked**.
3. Rust tests and Node bridge, native-update, installer and API tests pass.
4. CI passes on Windows, macOS and Linux for the **new integration diff**
   and new expected commit (do not substitute old stacked PR CI).
5. GitHub PR review shows no crossplatform-electron or Tauri worktrees,
   paid API integration, auto-installs, auto-publish or unexpected workflows.
6. Merge this integration PR only to `release/preview11-modern-app`.
   Source integration is not product approval and changes no running
   software, environment secrets, or live user preferences.

## Still gated before public release

Human review of actual VoiceOver / Narrator / NVDA speech, 200% text
scaling / RTL / IME / varied-DPI behavior, official asset rights,
publisher signing / notarization, native update channel and explicit
go-live approval. Unverified source entries have **no installer grant**.
