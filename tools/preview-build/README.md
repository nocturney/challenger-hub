# Challenger Focus 4.0 + Orbit Signature — Preview 1

**State: TEST BUILD ONLY. No merge, installation, source scans, or Production replacement.**

This is the chosen Orbit Signature applied to the actual Focus 4.0 task-first interface. The original production implementation retains the installer, updater, launcher, verification and settings functionality; this preview intentionally does **not** provide those actions.

## Why an offline preview?

The local Challenger backends on Chris and MacMiniOffice were not running when this preview was prepared. Rather than start privileged scanners or imply that stale information is live, the test builder reads the *real* cached project registry and source index from the local staging directory and creates a sanitized, read-only archive. The UI marks all state clearly as archived.

The archive data were last checked **2026-10-10** (from the local cache). There are **164** entries: 12 managed projects plus 152 curated independent projects, of which 73 remain restricted as unverified research candidates. **Installed software, available updates and Activity are not available in this snapshot**. No fake live statuses are displayed.

## Build (Node.js already available on both test hosts)

Run `node tools/preview-build/build.cjs` from the checked-out branch on Chris Windows or MacMiniOffice. It reads the existing vetted FocusCandidate-v4.0.0 stage and creates a sibling folder:

`Center/Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1`

The builder is fail-closed: if that directory already exists it refuses to overwrite it. It never changes the source stage, source registry, backends or production.

## Run and remove

Windows: run the **START-WINDOWS.cmd** file in the preview folder.
macOS: run **START-MAC.command** in the preview folder.

Open **http://127.0.0.1:17961/** *on that same machine*. Local loopback is deliberate: no LAN or external web hosting, no account, no paid API, no admin rights. To stop: Ctrl+C in that terminal. To remove: stop the server and delete *only* this test-preview folder.

The Node server serves only the approved UI assets and GET/HEAD endpoints; POST/PUT/DELETE return HTTP 405; no installer, launch, scanner, auto-sync or production dependencies are bundled. The local source cache is transformed before packaging: user-specific paths are excluded. Package manifest and checksums are included.

## Acceptance and limitations

Run `node tools/preview-build/browser-qa.cjs` after starting the local preview. This verifies 5 widths (1590, 1040, 768, 430, 320) in both themes, SVG/logo loading, 17 discipline links, 28 matches under 3D & CAD, 5 Photoshop results, independent dossier navigation, safe offline empty states for My software/Activity, rejected mutation requests and no browser JS errors.

This is **not an update to the operational app**. Focus functional parity and a separate deployment approval are required before promoting it beyond a design-test channel.

## What to review

Look at the search-first Explore view, the actual results table, dedicated project dossier, simple top navigation, Orbit Signature logo/contrast and responsive mobile layout. Feedback on product structure and reading hierarchy is more useful than detailed polishing until parity work is scoped.

No information from the offline snapshot should be used to decide whether to install or update software.