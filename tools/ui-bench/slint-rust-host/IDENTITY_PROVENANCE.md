# Challenger Native P5 — exact native identity links (source reviewed)

**Scope:** source-backed catalog **cross-references only**, not software
installation detection, publisher signature verification, working-process
assertion, or approval for install/update. Read-only, explicit scan only.
The native Rust host never launches any installed program.

A candidate link requires the pinned upstream source URL, exact curated
project ID, current OS, and an **exact upstream-reviewable native identifier**.
No display-name, version, directory, fuzzy match, icon or maker heuristic is
allowed. Duplicates (one native ID claimed by more than one OS record, or a
catalog ID duplicated) are refused. All reviewed mappings are compiled into
`src/identity.rs`; a code review is required to modify the allowlist.

## Pinned source identities (reviewed 2026-10-24)

| Catalog project + canonical repository | Platform / original source identifier | Immutable upstream source file | Git blob SHA-1 |
|---|---|---|---|
| `curated:rustdesk` · `https://github.com/rustdesk/rustdesk` | macOS `com.carriez.rustdesk` | [RustDesk Cargo.toml @ ed6a1ac, line 280](https://github.com/rustdesk/rustdesk/blob/ed6a1acce896fb165f2642aa13b609166d57a734/Cargo.toml#L277-L281) | `10025869435836f4a8de53a37b91cf851f550425` |
| `curated:gh-obsproject-obs-studio` · `https://github.com/obsproject/obs-studio` | macOS `com.obsproject.obs-studio` | [OBS Studio helpers.cmake @ 72e8665, line 57](https://github.com/obsproject/obs-studio/blob/72e86655715d9a25d69ce446aa4dd44ba58e10d2/cmake/macos/helpers.cmake#L53-L59) | `3afe4c344eb4a9566930d0b94daa1e49aa556e35` |
| `curated:rustdesk` · same source | Linux `rustdesk.desktop` | [RustDesk res/rustdesk.desktop @ ed6a1ac](https://github.com/rustdesk/rustdesk/blob/ed6a1acce896fb165f2642aa13b609166d57a734/res/rustdesk.desktop) | `4e7d14fe51d8707beecd7a698e944287ddda1c70` |
| `curated:gh-obsproject-obs-studio` · same source | Linux `com.obsproject.Studio.desktop` | [OBS Studio frontend/cmake/linux/com.obsproject.Studio.desktop @ 72e8665](https://github.com/obsproject/obs-studio/blob/72e86655715d9a25d69ce446aa4dd44ba58e10d2/frontend/cmake/linux/com.obsproject.Studio.desktop) | `43ec1555633f00afc31d111e83dd31db6899226a` |
| `curated:rustdesk` · same source | Windows stable MSI **UpgradeCode** `D3DC41E3-3C37-5D52-BB47-F6673705C01B` | [RustDesk res/msi/preprocess.py @ ed6a1ac, line 246](https://github.com/rustdesk/rustdesk/blob/ed6a1acce896fb165f2642aa13b609166d57a734/res/msi/preprocess.py#L244-L262) | `ffbd478806e212a945813b90341a4291b6ff5d4a` |

For **Windows** the identity is never the version-specific Uninstall
`PSChildName`/MSI ProductCode. The reviewed WiX source defines
`UpgradeCode = uuid.uuid5(uuid.NAMESPACE_OID, app_name + ".exe")` with
default `--app-name RustDesk`. Its deterministic code is
`D3DC41E3-3C37-5D52-BB47-F6673705C01B`. The Windows source reader
converts **only allowlisted UpgradeCodes** to MSI registry packed form
(`3E14CD3D73C325D5BB746F7673500CB1`), opens that exact key in
`HKLM:\SOFTWARE\Classes\Installer\UpgradeCodes`, and reads its values
as packed *ProductCodes*. It only links an uninstall ARP record when that
record has `WindowsInstaller=1`, uses a machine-wide uninstall root, and
its valid ProductCode packs to exactly one association under the approved
UpgradeCode. The native row continues to show its raw ProductCode;
`stable_identifier` is the vetted UpgradeCode reference. No installation
or MSI maintenance command, WMI `Win32_Product` enumeration, all-key
Installer scan, or package modification is performed.

If the UpgradeCodes key is absent or inaccessible, the reader returns
an unlinked, plain ARP row; **absence is not evidence of uninstall**.
Duplicate associations never authorize a catalog link.

## Real machine verification

- **MacMiniOffice2:** 88 .app bundle registrations in fixed directories.
  `/Applications/RustDesk.app/Contents/Info.plist` declares
  `CFBundleIdentifier=com.carriez.rustdesk`, version 1.5.0.
  `--check-identity-only` returned exactly one link to
  `curated:rustdesk`. Both source-pinned IDs were independently reviewed,
  but no OBS Studio bundle was seen in these roots. Interactive Slint QA
  opened RustDesk's source dossier, rejected a forged Dune 3D callback and
  returned via Back. [Actual QA screenshot](../../../docs/previews/focus-native-slint/08-reviewed-id-rustdesk-macos.png).
- **Chris Windows:** 24 Oct 2026, explicit read-only source-script replay
  against Windows Installer registry returned **153 ARP registrations,
  exactly one vetted RustDesk MSI association** in that tool's account
  context. This matched registered MSI ProductCode
  `{9D5F8A39-0D7B-4BC4-851D-DA8501D03DE7}`, packed
  `93A8F5D9B7D04CB458D1AD58100DD37E`, under the upstream-derived
  UpgradeCode registry key. Publisher field reported
  `Purslane Tech Pte. Ltd.`. Registry values are self-asserted; this
  **does not verify Authenticode signature**. This count can differ from
  earlier PowerShell session scans due to filtering and timing. Windows
  Rust binary/UI positive acceptance requires separately isolated QA.
- **Linux:** two exact first-party `.desktop` source identifiers are
  reviewed. Whether either is observed depends on the user/system launchers
  installed; a build-runner's seven OS launcher entries are not user-machine
  installation data. `.desktop` desktop-entry `Version` is **not**
  the binary's version. No Flatpak/Snap package identities were inferred.

**Security limit:** macOS bundle IDs, Linux desktop launchers and Windows
Installer registry entries are OS-local *declarations*, not cryptographic
publisher attestations or proofs that the app works. Catalog cross-references
do not change any launch/installation entitlement.

## Durable Worker / Activity audit (unchanged)

- Chris Windows: Preview9 and Preview10 servers, neither with
  `job-history.json` at their documented roots; they are not Preview12.
- MacMiniOffice: older Preview4 / Orbit servers, not pinned Preview12.
  A read-only check of the existing
  `~/Library/Application Support/OfficeOps/CraftSuite/install-progress.tsv`
  found **42 historical events** (timestamp range
  `2026-10-09T11:58:46Z` to `2026-10-09T12:02:48Z`, file last modified
  on 2026-10-09). Event kinds: 14 `downloading`, 14 `verified`,
  12 `installed`, 1 `already_current`, 1 `error`. This is a
  **legacy historical activity source**, not a currently running
  authenticated Preview12 Worker. The file was not modified, copied or
  wired into the current Activity page; no names/paths/credentials were
  extracted for this audit.
- MacMiniOffice2: a temporary Preview12 engine spawned only for the bounded
  read, no verified persistent Preview12 worker/history file.
- Chris-3DPC, Chris-Mini-PC, Mac-Bedroom: no running Challenger worker
  observed during their read-only process checks.
- Preview12 code has a process-memory `run.active`/`run.queue` and an
  optional `job-history.json` for *past* events. A historical file, whether
  present or absent, cannot prove present job-queue status.

**Decision:** Activity's persistent Worker/Queue remains explicitly
**Not connected**. Only the actual native-session read/refresh events are
shown. No new scheduler, background daemon or credential access is needed
to expose a fictitious queue. A future trusted authenticated, version-pinned
read-only live-worker endpoint with durable event provenance is required.
