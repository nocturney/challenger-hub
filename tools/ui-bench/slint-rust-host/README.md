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

Package as an independent, **developer-only** Mac app with a bundled Node
executable, research seed and Preview12 runtime (no Homebrew gettext addon):

    bash package-macos.sh
    dist/ChallengerHubNativePreview.app/Contents/MacOS/challenger-slint-rust-host --check-backend-only

Windows package recipe: `package-windows.ps1`. Install the Rust build
toolchain on a **dedicated development runner** first; this script does not
install tools, create scheduled tasks or modify an existing Challenger app.

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
- My software and Activity are visible but intentionally display **data
  unavailable** — not fake installed counts, fake empty queues or invented
  worker status. Live device-state parity is unfinished.

## Next gates — not yet implemented

Actual installed/update state, worker queue/timeline, deeper metadata and
additional source-pinned screenshots; accessibility, keyboard shortcuts,
IME/RTL, DPI and responsive small-screen visual QA; native Windows/Linux
interactive desktop tests, full resource/performance sampling, authenticated
distribution signing/notarization, Slint attribution and permission-gated
third-party installers. These remain blocked from Production. Do not infer
resource usage from the old Rust-only fixture benchmark.
