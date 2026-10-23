# Challenger UI renderer comparison — measured pilot results

Measured on 2026-10-23: MacMiniOffice2 Apple Silicon arm64, 10 CPU cores, 16 GiB physical memory, Node 24, Rust 1.99, Electron 45, Tauri 2.12, Slint 1.18.1. All three used the identical **181 actual records**: 14 managed, 152 curated and 15 research. Fixture SHA-256 `b1c6529329ddd95d93d1cc0a786d7040c397995d906dcfa40c541f37211f68e5`.

## Medians, three alternating GUI launches per framework

| Measurement | Electron (Chromium) | Tauri (system WebKit) | Slint (Rust-native rendering) |
| --- | ---: | ---: | ---: |
| Host spawn → application ready | 1372 ms | 1269 ms | **1025 ms** |
| Application internal startup → ready | 1014 ms | 1249 ms | 1007 ms |
| Aggregate process-tree RSS | 420.5 MiB / 4 processes | 103.4 MiB / 1 counted process | 99.3 MiB / 1 process |
| App executable size | 264 MiB Electron.app runtime | 5.3 MiB executable | 9.8 MiB executable |

**Correction for Tauri's WebKit:** Its process-tree RSS metric **does not include macOS WebKit XPC children, which have ppid=1**. In an additional independently sampled Tauri run, the newly observed WebKit GPU (31,136 KiB), WebContent (50,880 KiB), and Networking (11,248 KiB) processes added **~91.1 MiB RSS**. A **rough, single-run expanded RSS** would therefore be **~194.5 MiB**, not 103.4 MiB. This is an indicative before/after, **not** a 3-trial median nor proof of exclusive memory ownership; macOS shared memory and cached XPC processes further complicate measurement. Likewise Electron process-tree RSS sums multiple processes and double-counts shared pages.

**Not a full-app performance result.** The Electron executable size is from its actual macOS Electron.app runtime, whereas Tauri/Slint size is a bare executable excluding system OS libraries/frameworks; the comparison is indicative of bundling cost only. Slint virtualizes list rows; WebView versions build more DOM nodes. Slint uses an internal post-UI timer and Tauri/Electron use two animation frames; clocks do not indicate pixel-identical paint completion. No installed official backend, local printer data, adapter validation, network scans, updates or safe installers were benchmarked.

## Real screenshots (captured from live macOS app windows)

[Electron / Chromium — actual app](electron-window.png) · [Tauri / WebKit — actual app](tauri-webview-window.png) · [Slint / Rust-native — actual app](slint-native-window.png)

All are real window captures, not conceptual mockups. Electron and Tauri use **exactly the same HTML/CSS/JS interface**, filtered from an owned privileged IPC/Rust command respectively. Slint uses an independent declarative native UI with a genuine Rust search model, native ListView and selection callbacks. All three render real source-linked entries without installing anything or changing the application registry.

## Decision from this experiment

- **Electron** remains the safe reference for lowest migration effort and Chromium rendering parity, but has a large distributable payload and higher RSS on this Mac.
- **Tauri + Rust** looks strongest for reusing Orbit UI, broad platform support, smaller native main binary and incremental migration of security-critical backend operations. It **is a WebView application**, not a native graphics rewrite; using the original Node service as a sidecar would change its resource and maintenance profile.
- **Slint + Rust** already gives fine control over direct native rendering with no WebView, low app memory in this narrow scenario, small independent binary and richer custom surfaces. It requires larger UI/engine porting, separate compatibility/accessibility tests, careful text/IME support and license compliance. Its 9.8 MiB binary does not mean a full Challenger port will be 9.8 MiB.

**Recommendation:** Investigate a Tauri-compatible bridge/engine migration spike first, with Slint as the native alternative for a large future UI redesign or custom GPU-heavy views. Do not decide from this benchmark alone; first test official catalog, real source scans, private install capability, offline behavior, multimedia and accessibility on Windows, Linux and macOS. Keep the published Windows Preview 11 unchanged and use Draft PR for research.
