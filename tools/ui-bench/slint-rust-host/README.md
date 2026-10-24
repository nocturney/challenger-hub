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
source audit](IDENTITY_PROVENANCE.md)) contains **five immutable upstream-reviewed
OS identity rules**: RustDesk and OBS Studio native bundle IDs on macOS;
their official `.desktop` filenames on Linux; and the exact **RustDesk MSI
UpgradeCode** on Windows. The exact native identity must match *one*
observed OS registration, an exact **curated** project ID and its exact
verified repository URL. Duplicated native claims, wrong repository/kind,
prefixes, name similarity, unreviewed packages and mismatched OS never link.
For Windows the on-demand PowerShell reader verifies the **allowlisted**
upstream MSI UpgradeCode → Windows Installer packed ProductCode relationship
against the actual machine ARP product registration. Unlike the MSI
ProductCode this identity does not change with the app version. Missing
Installer association fails closed; `Win32_Product` is never invoked.

The on-demand OS registrations table now shows reviewed catalog ID links and
opens the **existing standalone project dossier** only after a second native
cross-check at click time. This is strictly a **source identity cross-reference**:
an app may self-declare its bundle ID. It is *not* binary signer verification,
software health, an installed-state entitlement or update authorization.

On MacMiniOffice2, `--check-identity-only` read **88 macOS .app registrations**
and correctly linked **one** reviewed source record, `curated:rustdesk`
(macOS `com.carriez.rustdesk`, locally reported version `1.5.0`).
OBS Studio is reviewed but absent from this known-root observation.
The two Linux launcher ID rules are source-reviewed but are only observed if
the actual host's exact upstream .desktop entries exist. On Chris Windows,
the complete fixed read-only PowerShell source reader found **one** vetted
RustDesk MSI UpgradeCode -> ARP ProductCode link among **153 registry rows**
in that account/session context; no other Windows app was linked. This is
not a claim about the Windows binary's Authenticode signer or an install
permission. It is also not a substitute for interactive Windows Rust GUI QA.
Identity regressions reject ambiguity, spoofed repos, unreviewed product
codes, source-kind confusion and platform mismatch.

Developer-only `--qa-verify-identity` exercises a real native OS read,
rejects a forged project-open callback, opens the linked RustDesk dossier and
returns to the OS registration view **only where a reviewed RustDesk source
registration exists**. It passed on MacMiniOffice2 (macOS exact Bundle ID)
and on Chris Windows (MSI exact Installer UpgradeCode). Chris's remote agent
runs in non-interactive **SYSTEM Session 0**: native Slint GUI/state smoke and
the dossier/back assertions passed with code 0, but this is **not** visual
user-desktop QA. Windows application packaging was transferred from the
CI head SHA as an isolated portable bundle, not installed or merged.

## Headless Windows CI: explicit Slint software renderer

The normal native app retains its existing GPU-backed FemtoVG renderer. A
GitHub-hosted Windows Server 2022 runner does not provide an OpenGL 2.0 driver,
so a native `--smoke` under the default renderer failed with `FemtoVG ...
requires an OpenGL 2.0 driver` despite the same packaged Windows binary
passing `--smoke` on Chris. Slint 1.18.1's `renderer-software` Cargo feature
is explicitly enabled **alongside**, not instead of, `renderer-femtovg`.
The Windows CI smoke sets only `SLINT_BACKEND=winit-software`, so the renderer
runs without an OpenGL dependency and still must return `FOCUS_NATIVE_GUI_PASS`
and exit code 0. No `continue-on-error`, GUI fake, production renderer override,
user profile change, GPU driver install or alternate test application is used.
A local native software-renderer smoke on MacMiniOffice2 passed. GitHub Windows
CI on the latest HEAD must still pass before the headless Windows gate is
considered green. User-desktop Session 1 visual and accessibility QA remain
separate uncompleted gates.

## P6: honest observation age and no silent stale links

The OS registrations view previously displayed an observation as "current"
after its two-minute native evidence validity window expired. The underlying
Rust identity validation already refused stale links, but a stale UI could
still show a formerly clickable source match until a user interaction.

The native UI now shows the real **last explicit read age**, refreshes only
that label through a lightweight UI timer (no OS read), and changes its state
to **expired** when the two-minute evidence window lapses. It keeps the
previous read-only registration rows visible for historical reference, but
removes every source ID link and disables dossier navigation until the user
explicitly presses **Inspect local apps** again. A failed re-inspection
displays an error while retaining the prior observation, without falsely
restoring its trust. It never starts any background scan or worker.

Test gates: unit regression checks the 119s/121s/future evidence boundaries;
`--qa-verify-stale` performs an explicitly requested real OS read,
simulates an observation aged 121 seconds (not a second live measurement),
and asserts preserved rows, zero links, an explicit expired state and no
automatic re-scan. Normal `--smoke` still verifies startup doesn't inspect
OS registrations on navigation.

A separate read-only source audit found **42 past CraftSuite installation
events** in MacMiniOffice's existing `install-progress.tsv` dated **9 Oct
2026**, including 12 `installed` and 14 `verified` events. These are
**historical legacy evidence**, not a current worker or job queue, and are
not silently imported into the native Preview12 Activity route. There was no
running, authenticated, version-pinned persistent Preview12 Worker on any of
the six checked devices. See [identity + worker provenance](IDENTITY_PROVENANCE.md).

## P7: first explicitly approved native install pathway

The prior read-only Slint/Rust GUI could not install anything despite the
original Challenger engine already having vetted GitHub-release adapters.
**Native Preview now has a limited, real install pathway**, separate from
its still read-only catalog and device inventory channels.

**User workflow:** Explore → curated app dossier → **Review installer**
(reads the official GitHub latest release; no download or file writes) →
inspect exact release version, asset name, GitHub-published SHA-256, size
and local managed-app destination → check **I approve this exact release**
→ **Install verified release**. The native callback *rechecks* the selected
catalog record, reviewed plan and checkbox. The Node installer bridge re-reads
the official upstream release and compares the entire approved fingerprint
(including asset URL, SHA-256, version, platform, size, target directory).
A changed/ambiguous/unavailable release refuses installation.

**Original worker reused:** `install-bridge.mjs` does not reimplement
archive handling. It copies the **original `Install-Challenger.js`** and
original reviewed adapter and curated registry manifests into a separate,
user-owned working directory. It passes exactly one selected GitHub
release asset whose upstream digest was present and confirms the original
worker's own downloaded-byte SHA-256 check, macOS bundle verification
or safe Windows archive extraction, and persisted managed install record.
The work area and `managed-installs.json` are isolated under
`ChallengerNativePreview/install-state`, not the original Preview11 or
Production runtime. The application payload goes to the *existing original
worker's reviewed app destination*: macOS
`~/Applications/ChallengerHub Apps`; Windows
`D:\Velvet\Installers\ChallengerHub\Managed` (requires D: to exist).
No install adapter is enabled on Linux; no automatic scheduler or scan.
Never run as Unix root or Windows SYSTEM Session 0. No local filesystem writes
are performed when browsing/reviewing an installer.

**Candidate policy:** only an exact curated catalog ID tied to the reviewed
`challengers.json` repo and `adapters.json` platform rule, exactly one
matching *stable* GitHub Release asset with a published SHA-256, safe official
URL and explicit consent. Research, managed-only catalog listings, unsigned
or ambiguous assets, missing digests and unsupported OS/arch fail closed.
A GitHub release digest and code-sign verification are **not proof of a
trusted publisher's real-world identity**.

**Verified local 24 Oct:** Compositor `v1.5.8`, official
`Compositor.dmg` (~8.1 MiB), published SHA-256
`dda5ff4937689e260b0515e1b1c08e2f273836700d9907d411a4e47d42e8c409`.
The unmodified worker passed a real **download → digest verify → DMG
bundle/code-sign inspection** without installation. The new native bridge
then passed a **complete download, bundle installation and persisted managed
state** inside a *throwaway /tmp HOME*, whose files were deleted on exit.
No ordinary user application was installed or replaced. The Slint Mac
interactive QA passed official release Review and rejected an attempted
installation with an unchecked approval checkbox. See
[`09-reviewed-install-compositor-macos.png`](../../../docs/previews/focus-native-slint/09-reviewed-install-compositor-macos.png).

**Current limitations:** no officially distributed/signed installer app,
no Windows desktop-user visual QA, no installed-app inventory reconciliation,
no cancellation/progress widget for long downloads yet (keep window open;
the worker is bounded and joined on shutdown), and no install success on a
real user's ordinary home/profile has been attempted without an explicit
software choice. Native release QA must be distinguished from the
one-shot sandbox install acceptance.

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
