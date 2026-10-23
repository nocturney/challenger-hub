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

## Pre-release policy (Preview 3 and later)

**Every successfully validated, user-testable preview gets a versioned GitHub pre-release**, never a replace-in-place ZIP. Failed, broken or incomplete development builds stay local. Published previews are immutable; never force-push a published tag, overwrite an asset, merge a draft PR or deploy Production without separate approval.

One artifact per host from the *same pushed Git commit*. Do not upload a package made on an uncommitted, unreviewed branch. The commands below use the existing GitHub CLI (no paid API), source-controlled assets and genuine QA captures; first run every stage locally on each operating system:

1. Audit upstream assets manually for provenance and screenshot authenticity; update the explicit allowlist in collect-project-media.cjs, then run: node tools/preview-build/collect-project-media.cjs. Do **not** add promotional art or content with unknown licensing.
2. Create a new branch based on the previous media PR branch, keeping the PR chain explicitly stacked. For Preview N, build in an unused directory using: node tools/preview-build/build-media.cjs N. The builder refuses to overwrite existing Preview N; Preview 1 and Production are never modified.
3. Start the numbered local server using START-WINDOWS.cmd or START-MAC.command (port = 17960 + N). Run node tools/preview-build/browser-qa-media.cjs N and Node tests on **both** Windows and macOS. The browser suite covers all three authentic dossiers, five viewports, two themes, restricted research, no external requests and read-only methods. Do not continue after failure.
4. Archive only after a verified QA report with node tools/preview-build/release-preview.cjs N archive on both hosts. It verifies manifest SHA256, the screenshot coverage gate, real-browser results and the unpacked ZIP again.
5. Push the branch, then create a **Draft PR** against the immediately previous preview branch; do not merge. On Windows create the **Draft Pre-release** with node tools/preview-build/release-preview.cjs N draft /absolute/path/RELEASE-NOTES.md. It uploads the Windows ZIP.
6. From the tested Mac checkout, run node tools/preview-build/release-preview.cjs N upload to attach the separately verified macOS ZIP to the *same* draft release.
7. On Windows run node tools/preview-build/release-preview.cjs N publish. It requires both uploaded assets with GitHub SHA256 digests and identical target source commit before publishing a non-draft **Pre-release**. Verify tag, downloads, digest, draft PR and screenshot gallery after publication.

The CLI never merges code, installs anything, starts production services, changes installed software, or calls paid models/APIs. It binds the preview UI to loopback. Artifact and license sources are pinned and the historical October 10, 2026 snapshot is always labelled archived.
