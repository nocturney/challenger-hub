# Challenger Hub — Rust-native Slint host + one-shot Node sidecar

Isolated P0 implementation over PR #28. The existing `main.slint` is compiled
directly into the Rust executable; **the beta `slint-ui` Node binding is not
loaded**. The existing Preview12 engine is kept temporarily, never rewritten
or granted install/update actions by this bridge.

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

This P0 bridge deliberately reuses the PR #28 UI. Full Focus/Orbit feature
parity, 17 disciplines, source-pinned artwork, navigation, accessibility,
IME, DPI and installation gates remain separate P1–P3 work. No benchmark
numbers should be inferred from the previous Rust-only fixture benchmark.
