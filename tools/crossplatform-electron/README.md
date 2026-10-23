# Challenger Cross-platform Pilot 12 — one shared Electron shell

**Private experimental branch, not a Preview 12 release or production upgrade.**

## Rationale

Reuse the existing audited Challenger Node backend, source-media manifest, Orbit UI, catalog and developer-written installer policies. Avoid three independently maintained window shells. Electron bundles Node and Chromium and supports Windows, macOS and Linux from one main process. Pilot is pinned to Electron 45.0.0 and @electron/packager 20.3.0. Do not remove the tested Preview 11 Windows release.

## New capabilities in this branch

- Shared Electron main process: bundles and validates original runtime; starts a private child via Electron utilityProcess; browser never receives Node integration; context isolation and Chromium sandbox enabled.
- Own application profile: CrossPlatformPilot12, independent from all previous Preview builds. Same source-linked catalog and real backend, no background Scout or automatic catalog promotion.
- Platform evidence contract: reports Windows/macOS/Linux independently for **curated support**, **reviewed install adapter**, and **locally verified package with explicit approval**. Unknown is not unsupported. Displayed as labeled availability hints in Explore and project details, without any additional permission grants.
- The source-vetted installer still only accepts darwin and win32. Linux install is **blocked** pending purpose-built reviewed adapters for verified AppImage/Flatpak/deb/rpm or other source-verified distribution. Merely having a reported Linux app does not authorize it.

## Native shell boundaries

- No Node APIs in Chromium renderer, strong isolation and sandbox.
- Requests made by the app are constrained to the owned 127.0.0.1 port; external https links open only in the system browser.
- Write-session header is injected by the Electron main process only for requests to its owned localhost port, never passed to an arbitrary remote page.
- All bundled original assets, source modules and media are checked against SHA256, and immutable runtime code is checked again on future launches.
- No auto-installs, no modified system default app associations or background scheduled services.

## Reproduce

On the Windows dev checkout:

    node tools/desktop-build/build-runtime.cjs 12
    node --test tests/platform-availability.test.cjs
    node tools/desktop-build/qa-platform-availability.cjs

On macOS or Linux (with Node 22+):

    cd tools/crossplatform-electron
    npm ci
    npm run smoke
    node build.cjs darwin arm64
    node build.cjs linux arm64
    node build.cjs linux x64

The native packaging is host/target sensitive. macOS mac builds should run on a real Mac. Linux release quality requires running Linux under its own window system, installer packaging, executable identity verification, package signing policy and updating the installer adapters for that OS.

## Limits

- A source report is not a guarantee that a project runs on a platform. The UI must not confuse “Reported” or “Reviewed adapter” with a verified local installer.
- The native Linux shell can be tested before the first Linux installer is approved. Linux install actions are not permitted until that work passes QA.
- No production release is implied by successful dev builds. Explicit QA and promotion remain mandatory.
