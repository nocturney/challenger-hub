# Challenger Native P4 — reviewed native identity links

The only accepted links are **exact upstream-reviewed native identifiers** tied to:
1. An exact `curated:<id>` Challenger record (never a research or managed entry).
2. That exact record's canonical upstream source URL (never a similarly named fork).
3. A native OS registration whose **identifier exactly equals** the reviewed value.
4. Exactly one matching OS registration and exactly one corresponding catalog record.

No fuzzy names, paths, logos, description similarity, executable names, display versions, release numbers, source URL prefixes, install buttons, or network searches can create a link. A duplicate bundle ID or mismatched upstream project fails closed. The reviewed rules are compiled into `src/identity.rs` and require a code-reviewed change to update.

| Challenger project | OS / official ID | Locked upstream source file | Blob SHA-1 |
|---|---|---|---|
| `curated:rustdesk` · `https://github.com/rustdesk/rustdesk` | macOS `com.carriez.rustdesk` | [RustDesk `Cargo.toml` @ ed6a1acce896fb165f2642aa13b609166d57a734, line 280](https://github.com/rustdesk/rustdesk/blob/ed6a1acce896fb165f2642aa13b609166d57a734/Cargo.toml#L277-L281) | `10025869435836f4a8de53a37b91cf851f550425` |
| `curated:gh-obsproject-obs-studio` · `https://github.com/obsproject/obs-studio` | macOS `com.obsproject.obs-studio` | [OBS Studio `cmake/macos/helpers.cmake` @ 72e86655715d9a25d69ce446aa4dd44ba58e10d2, line 57](https://github.com/obsproject/obs-studio/blob/72e86655715d9a25d69ce446aa4dd44ba58e10d2/cmake/macos/helpers.cmake#L53-L59) | `3afe4c344eb4a9566930d0b94daa1e49aa556e35` |

Both source blobs were inspected using GitHub and pinned by their immutable commit IDs on 2026-10-24. There are currently **no reviewed Windows uninstall registry IDs** and **no reviewed Linux .desktop IDs**; those platforms must show **zero confirmed catalog ID cross-references** until a first-party manifest is independently reviewed. Do not extrapolate macOS identifiers to Windows or Linux.

## MacMiniOffice2 live test

The existing user-owned `/Applications/RustDesk.app/Contents/Info.plist` declares:
- `CFBundleIdentifier = com.carriez.rustdesk`
- `CFBundleShortVersionString = 1.5.0`
- `CFBundleName = RustDesk`

The on-demand macOS reader observed this bundle in its 88 known-root records. The existing 181-project source-backed engine returned exactly `curated:rustdesk` and the reviewed upstream repository URL. This enables exactly one **catalog cross-reference**, rather than name-based inference. The GUI surfaces the upstream review label and allows the user to open the catalog dossier; it does **not** mark the project as *installed*, *healthy*, *updateable*, *current*, *trusted signer*, or *authorized for installation*.

**Security boundary:** Info.plist bundle identifiers are app self-declarations, **not cryptographic evidence that the binary was signed by the upstream author**. Future stronger identity verification needs publisher signature/team-ID, OS package manifest or exact package checksum provenance, as appropriate to each platform. The cross-reference never changes privileges or installs/launches any app.

## Persistent worker source audit

- **MacMiniOffice2:** the Preview12 Node server exists only for a bounded one-shot read. No separately running verified Preview12 worker or durable `job-history.json` was found. GUI session events are legitimate *session-only* diagnostics, not worker state.
- **Chris Windows:** two local Challenger servers were identified from their manifests as **Preview9** and **Preview10**; both lack a `job-history.json` at their own server roots. Neither is the pinned Preview12 worker.
- **MacMiniOffice:** existing Preview4 / Orbit preview processes. Not the pinned Preview12 worker.
- **Chris-3DPC, Chris-Mini-PC and Mac-Bedroom:** no active Challenger worker process observed during the read-only check.
- The Preview12 source has a `run.active`/`run.queue` **process-memory** queue and an optional `job-history.json` for persisted **past** events. An absent file is **not** evidence of no real jobs; a historical file cannot prove live worker or queue health. Never connect to old preview endpoints under a misleading Current/Idle label.

**Decision:** Leave Activity's persistent Worker/Queue area explicitly *Not connected*. Do not add new background services, scheduled tasks, credential access, or pretend an old preview is current. Before any persistent Activity connection, identify a currently running worker with an authenticated, version-pinned, read-only status endpoint and a proven durable event source, with known retention and owner. This is an unmet prerequisite, not a user action currently required.
