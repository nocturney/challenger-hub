# Challenger Hub
Private, versioned source for Challenger Hub: a localhost desktop catalog of independent software alternatives, on Windows and macOS.

## Status
- Production v2.5.1: 12 Craft applications + 79 independent projects (91 catalog entries).
- Next: v2.5.2 source-neutral polling with verified source mirrors and equal scan priority.
- Runtime remains separate from this repository; source commits do not deploy automatically.

## Components
- server.js: localhost control API and release integrity gate.
- app.js, ux-experience.js, style.css, index.html: responsive catalog UI.
- challenger-core.js, challengers.json, sources.json: curated catalog metadata.
- Install-Challenger.js, adapters.json, portable-assets.json: sensitive installation boundary.
- official-icons.json, local-icons/, brand-icon.png: creator-confirmed artwork.
- platform/windows and platform/macos: launch/native wrapper source, never compiled binaries.
- shader-bundle.js includes licensed third-party code; see THIRD_PARTY_NOTICES.md.

## Development
Commands: node --check server.js; node --check app.js; node --check challenger-core.js;
node --test tests/*.test.js (when tests are present).
Run staging with CHALLENGER_DISABLE_SCAN=1 and CRAFT_CENTER_PORT=17876; on Windows set environment variables through PowerShell.
Never execute deployment jobs or install unverified research-only software during tests.

## Git branches
main is the stable source; tag v2.5.1 matches the current production UI and engine.
develop contains v2.5.2 or other not-yet-deployed changes.
Private repository: https://github.com/nocturney/challenger-hub

## Security
- Never commit local install records, release caches, authentication, signed binaries or system backups.
- A new upstream Git tag or mirror signal is not package validation.
- Installation requires explicitly vetted packages, platform/adapter approval and SHA-256 verification.
- CI workflow is manual to avoid unexpected hosted build charges.
See docs/OPERATIONS.md.
