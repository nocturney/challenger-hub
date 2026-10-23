# Challenger UI renderer comparison — real data, isolated experiment

**Research-only branch.** No change to Preview 11, PR #26, catalog, installation rights, scheduled jobs, Electron cross-platform pilot, or Production.

The same 181 real source entries from Challenger Preview 11 are used in three independent desktop UI prototypes on **the same Mac (Apple Silicon, 10 CPUs / 16 GiB RAM)**:

1. Electron/ — Chromium/Node Electron 45 baseline, one local IPC search function, source-linked cards.
2. Tauri/src-tauri/ — Tauri 2 with built-in WebKit/WebView and Rust search command, **exactly the same HTML/CSS/JS as Electron**.
3. Slint/ — Rust with Slint 1.18.1 native declarative rendering, Rust search and selected-item callbacks; **no Chromium, DOM, WebView or Node**.

All three have search input, discipline filter, selectable real projects and a detail panel. The fixture includes **14 managed, 152 curated and 15 research-only** projects. No downloads or installation actions are present.

## Build and test

Install Rust via [official rustup](https://rustup.rs) and Node 22+.

    node tools/ui-bench/build-fixture.cjs
    cd tools/ui-bench/electron && npm ci && npm run smoke
    cd ../slint && cargo test && cargo build --release && ./target/release/challenger-native-bench --bench-smoke
    cd ../tauri/src-tauri && cargo test && cargo build --release && ./target/release/challenger-tauri-bench --bench-smoke
    cd ../.. && node bench.cjs 3

Both Rust apps load the same fixture embedded at compile-time. The common web UI uses local IPC only and no web service; Slint compiles its UI into Rust code. The smoke flag performs a true graphical startup, verifies 181 records and exits. User profile for Electron benchmark is in a separate temporary directory.

## Metrics and limitations

- 3 cold-ish process startups with identical data on the same Mac, alternating the three launchers. Records host-initiated ready time, app-reported startup time and aggregate descendant RSS.
- **These are directional microbenchmarks, not scientific CPU/GPU comparisons or full app acceptance tests.** Slint uses a timer after opening its UI; WebView versions wait two animation frames and a Rust/IPC acknowledgement. Treat small startup differences as noise. Slint's list is virtualized; web versions render 181 cards in the DOM. Real memory use of system WebKit helper processes may be undercounted in process-tree RSS; shared pages may be double-counted.
- App executable size is **not** full deployment size. Electron bundles Chromium; Tauri uses system WebView and requires WebKitGTK on Linux; a complete Challenger port may need a Node sidecar or rewriting the existing engine in Rust, with a larger deployed footprint.
- Use an extensive real workload test (catalog scans, search, official release verification, download/installer safety, idle CPU, accessibility, window resizing, startup, and upgrades) before choosing a product architecture.
- UI customization isn't unbounded. Both WebView and native renderer support advanced 2D, GPU surfaces and motion; Slint can use a custom renderer, but native accessibility, text editing, compositor, IME, multi-monitor support and OS integrations must still be verified. Slint license requires compliant use; this prototype visibly credits Slint.
- No API keys, paid services, Codex quota or new external running agent were used.

## Results — completed 2026-10-23

All three real GUI prototypes built successfully, rendered the same 181 entries, and passed three alternating release-mode runs. **[Open the measured comparison, limitations, and authentic app screenshots](results/comparison.md).** Machine-readable medians and all nine individual trials: [benchmark-macos-arm64.json](results/benchmark-macos-arm64.json).

Tauri's 103.4 MiB process-tree RSS **excludes** separate system-owned WebKit XPC services. A supplementary Mac run found ~91 MiB of newly observed WebKit processes; the report discloses this uncertainty rather than claiming a decisive 4× memory advantage over Tauri.

**Promotion gate:** Do not merge this experiment into Preview 11. Measurements now exist, but a product architecture selection requires full-backend workflows, cross-OS accessibility and packaging validation.
