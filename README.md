# Challenger Hub
Private, versioned source for Challenger Hub: a localhost desktop catalog of independent software alternatives, on Windows and macOS.

## Status
- **UI v2.5.6:** deployed and browser-tested on Windows and macOS on 2026-10-10.
- **Backend versions:** Windows 2.5.3, macOS 2.5.2. This UI-only update intentionally preserves the existing scanner/runtime code on each host.
- **Catalog:** 12 Craft applications + 79 independent projects (91 catalog entries).
- **Source checks:** all 91 entries use one equal-priority queue and a 12-hour cadence.
- **Mirrors:** GitHub Atom plus specifically verified GitLab, KDE Invent and Codeberg sources.
- Runtime remains separate from this repository; Git pushes do not deploy automatically.

## Components
- server.js: localhost control API and release integrity gate.
- app.js, ux-experience.js, style.css, index.html: responsive catalog UI.
- challenger-core.js, challengers.json, sources.json: curated catalog metadata.
- Install-Challenger.js, adapters.json, portable-assets.json: sensitive installation boundary.
- official-icons.json, local-icons/, brand-icon.png: creator-confirmed artwork.
- platform/windows and platform/macos: launch/native wrapper source, never compiled binaries.
- platform/shared/Resolve-CraftRelease.js and platform/windows/Install-CraftSuite.ps1 / Install-WordCraft-Portable.ps1: vetted installer source; 2026-10-10 PowerShell exit-code repair and official Atom fallback; see docs/INSTALLER_VERIFICATION_HOTFIX_2026-10-10.md.
- shader-bundle.js includes licensed third-party code; see THIRD_PARTY_NOTICES.md.

## Development
Commands: node --check server.js; node --check app.js; node --check challenger-core.js;
node --test tests/*.test.js (when tests are present).
Run staging with CHALLENGER_DISABLE_SCAN=1 and CRAFT_CENTER_PORT=17876; on Windows set environment variables through PowerShell.
Never execute deployment jobs or install unverified research-only software during tests.

## Git branches
main contains the reviewed UI source (2.5.6): contextual Update all with explicit approval, no misleading ellipsis, and explicit inspector open/close. Backend scanner parity is tracked separately; see docs/UI_RELEASE_2.5.6.md.
develop is the integration branch for upcoming changes; never deploy an untested commit.
Private repository: https://github.com/nocturney/challenger-hub

## Security
- Never commit local install records, release caches, authentication, signed binaries or system backups.
- A new upstream Git tag or mirror signal is not package validation.
- Installation requires explicitly vetted packages, platform/adapter approval and SHA-256 verification.
- CI workflow is manual to avoid unexpected hosted build charges.
See docs/OPERATIONS.md.
