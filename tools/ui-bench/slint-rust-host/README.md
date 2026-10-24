# Challenger Hub — Rust-native Slint host + one-shot Node sidecar

Isolated P0/P1 implementation over PR #28. A new **`ui/focus.slint`**
compiles directly into the Rust executable; the former Slint/Node benchmark
`../slint-node-bridge/main.slint` is preserved untouched for comparison.
**The beta `slint-ui` Node binding is not loaded**. The existing Preview12
engine is retained temporarily without install/update permissions.

## Flow and safety

Rust host → bundled/local `node sidecar.mjs` (one-shot JSON stdout) →
existing `readFromRealEngine` → private ephemeral loopback Challenger
Preview12 server → GET health/state → terminated server → JSON →
Rust schema/count/trust checks → native Slint UI.

- Exact protocol version, backend version/platform/architecture and
  **14 managed + 152 curated + 15 research = 181 unique records** checked
  before the UI opens; research entries remain visible.
- Scanner-off and no-write checks are mandatory. No POST, install, filesystem
  mutation from UI, external network discovery, scheduled tasks, daemon,
  background refresh or telemetry.
- Node subprocess stdout (1 MiB) and stderr (32 KiB) are capped; a 22s
  supervisor timeout ends the process tree, including the temporary server.
  A failed or unexpected response fails closed.
- For packaged builds Node, service runtime and pinned research seed must
  be bundled. There is no fallback to global Node in a package.
  For developer runs the system Node and existing repo runtime may be used.
- Refresh starts the same one-shot read without freezing the Slint UI,
  never runs concurrently, and completes/terminates before process exit.
- This is not a production build or permission to install third-party software.

## Reproduce on a developer Mac

From repo root, build the existing experimental test backend once if absent:

    node tools/desktop-build/build-runtime.cjs 12
    cd tools/ui-bench/slint-rust-host
    cargo test --locked
    cargo run -- --check-backend-only
    cargo run -- --smoke
    cargo run -- --qa-preview-results   # self-closes after 22 seconds
    cargo run -- --qa-preview-dune      # self-closes after 22 seconds

Actual Mac window captures (Discover / Results / Dune 3D dossier) are in
[`docs/previews/focus-native-slint`](../../../docs/previews/focus-native-slint/README.md).

Package as an independent, **developer-only** Mac app with a bundled Node
executable, research seed and Preview12 runtime (no Homebrew gettext addon):

    bash package-macos.sh
    dist/ChallengerHubNativePreview.app/Contents/MacOS/challenger-slint-rust-host --check-backend-only

Windows package recipe: `package-windows.ps1` (optimized release by default).
CI uses `package-windows.ps1 -DebugBuild` to package the already-tested debug
binary without a redundant and expensive release rebuild; this checks the
bundle/sidecar contract, **not Windows Release optimization parity**. Install
the Rust toolchain only on a dedicated development runner. This script does
not install tools, create tasks or modify an existing Challenger app.

## QA and limitations

Only claim each platform as validated after running its native GUI and package
test. The Rust binary's dynamic dependencies should be checked with
`otool -L` (Mac) or the corresponding native tool; ensure no
`libintl.8.dylib` or Homebrew references. Mac app bundle is ad-hoc signed
for local development, **not** distributed/notarized. Windows/Linux packages
need native smoke and security review.

Slint 1.18.1 offers GPLv3, royalty-free desktop, and commercial terms. The
royalty-free desktop route requires prescribed Slint attribution (an accessible
AboutSlint widget or public distribution-page badge); a plain "powered by"
footer is not assumed sufficient. Review third-party notices as well before
public release. See https://github.com/slint-ui/slint/blob/master/FAQ.md .

## Focus/Orbit native UI — implemented read-only routes

This is a **real native Slint interface**, not an Electron/WebView/CSS wrapper:
- Approved task-first navigation: Explore, My software, Activity. The permanent
  sidebar and always-visible project inspector are removed.
- Discover home: primary search and **17 canonical disciplines**, with
  live counts. The unchanged 181 source records have 79 raw category strings;
  Rust maps them to the 17 approved Focus domains *only in the view*, with
  a regression asserting that no record disappears.
- Explicit results route: compact sortable-style list with native input
  filtering and a truthful **30-record initial page / Show 30 more** control.
  The list is not yet user-sortable; do not claim sorting parity.
- Dedicated full-page project dossier: facts only from the live backend,
  source/research status, source-provided category/platform/license/version,
  optional challenged software and an HTTPS repository link that is opened
  only on user click after strict host/scheme checks.
- Back/Forward stack (native app navigation) preserves query and selection;
  manual Refresh rereads the authentic backend without UI-thread blocking.
- Light/Dark appearance. All 15 research candidates remain searchable and
  explicitly tagged unverified; no action can promote or install them.
- The actual project-owned Orbit icon is embedded. Dune 3D and Material Maker
  have **source-verified upstream icons and true application screenshots**
  from the existing approved media manifest, matched only by exact
  repository ID/source. Asset SHA256, licenses and source commits are recorded
  in `ui/MEDIA_PROVENANCE.md`. Other projects have a neutral, non-fabricated
  fallback until their assets are independently vetted.
- **My software P2 (limited, real data):** the authentic Preview12 engine's
  existing local name/path/version detector now contributes **managed-only
  installation signals** for its 14 managed applications. The sidecar passes
  the detected version, source-reported version and *possible* update hint
  through versioned `challenger.native.catalog.v2` with exact provenance,
  scope, timestamp and per-kind fail-closed validation. Curated (152) and
  research (15) entries are explicitly excluded. Linux's current detector is
  unsupported and reports **unavailable**, not false zeros. macOS/Windows
  rows may say *not detected*, which is not proof of absence or authorization
  to install. No installed paths are transferred.
- **Activity P2 (limited, real data):** native in-memory events from the
  **current preview session only** show actual initial reads, successful
  manual Refresh and refused Refresh. Failed reads preserve the previous
  validated catalog/inventory. There is no fabricated persistent worker
  history or empty queue: the Node engine child is intentionally ephemeral,
  so its own activity state is not treated as the real device job queue.
- Existing Preview12 OS detection uses read-only filesystem and version
  metadata. Network/source scanning stays disabled; this UI never triggers
  OS-wide software discovery or an install/update/launch.

## P3: explicit native OS registrations — on-demand only

The dedicated **My software → OS app registrations** view now reads real OS
registration evidence directly from the native Rust host, independent of the
181-project source catalog and the 14-app managed detector:

- macOS: bounded, non-recursive .app bundle observations at fixed
  /Applications, /System/Applications, Utilities and ~/Applications roots.
  Bundle IDs and versions come from Info.plist via system-owned plutil,
  without executing application code. Untrusted symlinks are skipped.
- Windows: existing Add/Remove Programs uninstall entries from HKLM/HKCU
  (including 32-bit registrations) through a fixed read-only PowerShell
  command. It does not launch, download, verify, repair or uninstall apps.
- Linux: .desktop launchers in fixed system and user desktop-entry roots
  (including Flatpak/Snap launcher export locations), **not** package-manager
  or complete executable inventories. The .desktop Version key is explicitly
  ignored because it describes the desktop-entry format, not an app version.
- All platforms: at most **512** distinct records per observation, sanitized
  bounded names, explicit truncation and source/coverage metadata. UI displays
  a searchable native table with name, reported version, identifier and
  registration source. The scan runs only after **Inspect local apps**, on a
  separate thread, and is neither scheduled nor coupled to catalog Refresh.
  Failure is reported and preserves the last valid read.
- Platform-specific registration **does not prove installation correctness or
  absence**. Missing a record is not evidence of "not installed". Only
  explicitly reviewed upstream native IDs receive a **catalog cross-reference**
  (P4 below), never an installed-state claim or permission to install. No
  application state persists on disk or is sent to an external service.

Local observations (24 Oct 2026): MacMiniOffice2 yielded **88 visible .app
bundle records** in its known application roots (bounded complete in that
scope). A separate read-only PowerShell source check on Chris Windows found
**154 uninstall registry entries** in the account/session context used by the
remote tool; this is not yet a Windows-native Rust UI acceptance test.
Actual Mac window QA at
[`docs/previews/focus-native-slint/07-os-app-registrations-macos.png`](../../../docs/previews/focus-native-slint/07-os-app-registrations-macos.png).

Developer CLI `--check-device-only` explicitly runs the same bounded OS
read with validation, emitting only its count/scope, never application names
or paths. This is suitable for cross-platform CI checks. The ordinary
`--smoke` asserts no implicit OS scan occurred on navigation.

## P4: reviewed exact ID → source project link

A new `src/identity.rs` mapping (see [upstream verification and Worker
source audit](IDENTITY_PROVENANCE.md)) contains **two immutable upstream-reviewed
macOS bundle IDs**, RustDesk and OBS Studio. The exact bundle identifier must
match *one* observed OS record, an exact **curated** project ID and its exact
verified repository URL. Duplicated bundle claims, wrong repository/kind,
prefixes, name similarity, unreviewed packages and mismatched OS never link.

The on-demand OS registrations table now shows reviewed catalog ID links and
opens the **existing standalone project dossier** only after a second native
cross-check at click time. This is strictly a **source identity cross-reference**:
an app may self-declare its bundle ID. It is *not* binary signer verification,
software health, an installed-state entitlement or update authorization.

On MacMiniOffice2, `--check-identity-only` read **88 macOS .app registrations**
and correctly linked **one** reviewed source record, `curated:rustdesk`
(macOS `com.carriez.rustdesk`, locally reported version `1.5.0`).
OBS Studio is reviewed but absent from this known-root observation. On Windows
and Linux, no OS ID mappings have yet been authoritatively reviewed; their
link counts therefore remain zero rather than guessing by name. Identity
unit/security regressions verify ambiguity, spoofed repos, source kind and
wrong-platform rejections.

Developer-only `--qa-verify-identity` exercises a real native OS read,
rejects a forged project-open callback, opens the linked RustDesk dossier and
returns to the OS registration view on an explicitly provisioned Mac. It is
not run on unrelated CI machines without a RustDesk registration.

## Next gates — not yet implemented

A truly exhaustive OS-wide package/application inventory, cryptographic
binary publisher identity and platform-authoritative package IDs, and genuine
persistent-worker queue/history (distinct from these P2 managed-only signals
and preview session diagnostics), user-controlled sorting, deeper metadata,
and additional source-pinned screenshots; accessibility, keyboard shortcuts,
IME/RTL, DPI and responsive small-screen visual QA; native Windows/Linux
interactive desktop tests, resource/performance sampling, authenticated
distribution signing/notarization, Slint attribution and permission-gated
third-party installers. These remain blocked from Production. Do not infer
resource usage from the old Rust-only fixture benchmark.
