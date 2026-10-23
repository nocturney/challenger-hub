# Challenger Hub · Slint native UI over the existing live Node engine

**Isolated feasibility spike**, based on the real 181-record Challenger Preview 12 test branch. No changes to Production, the approved Windows Preview 11 release, installed applications, Scout, or installer permissions.

## What this proves

- Real **native Slint rendering (Rust-powered, no Chromium, no WebView, no DOM)** while the existing Node backend remains in place.
- On-demand read-only data from the real local Challenger service (`/api/health` and `/api/state`, scoped to a random ephemeral loopback port).
- Exactly **14 managed + 152 curated records** are fetched from the real backend; the additional **15 unpromoted research candidates** come from the already-pinned source candidate JSON (not from a fake benchmark fixture). 181 total.
- Native list virtualization, live search, discipline filters, selectable project detail, and **Refresh** to re-read the original local catalog on request. No background polling.
- A checked secret session token, scanner disabled by `CHALLENGER_DISABLE_SCAN=1`, and **no POST/write/install calls**. The service is terminated before rendering begins, then restarted only for explicit refresh. No daemon or scheduled task.

## Reproduction

From the parent repository:

    node tools/desktop-build/build-runtime.cjs 12
    cd tools/ui-bench/slint-node-bridge
    npm ci
    node --test bridge.test.mjs
    node bridge.mjs --smoke
    node bridge.mjs

On macOS ARM64, the prebuilt `slint-ui@1.18.1` Node binding currently links directly against Homebrew `/opt/homebrew/opt/gettext/lib/libintl.8.dylib`. On the test Mac, Homebrew gettext was absent; **the regular package import initially failed**. For **local testing only**, a compatible preexisting `libintl.8.dylib` was resolved through a temporary **per-process `DYLD_LIBRARY_PATH`**, without installing or copying any system library. **This workaround is NOT a viable release dependency**. A production distribution must package and license all required libraries correctly or rebuild from source with proper library search paths. Windows x64 import of the same published Node binding succeeded without this issue.

## Important architectural conclusions

This is a practical migration bridge: we can migrate **the UI to Slint first** and retain the existing Node engine temporarily. We do **not** need to rewrite the entire engine immediately. But Node+Slint can have a larger memory/runtime footprint than the independent all-Rust Slint executable, so it is not by itself evidence that a full app will match the 99 MiB Rust-only benchmark. The Node Slint binding is marked **beta** by its maintainers; evaluate native package dependencies, text input/IME, accessibility, app signing, Windows event-loop responsiveness, and Linux native packages before committing to it.

Long-term target remains **Slint frontend + Rust application services**, with carefully verified replacements of Node functionality in independent stages. The exact native UI technology should remain reversible until the real production backend has parity.

## Validation

- Mac ARM64: real preview12 backend read and 181 records verified; search and native renderer smoke passed; [actual macOS window](live-slint-mac.png).
- Windows x64: official Slint 1.18.1 Node native addon successfully loaded; full GUI acceptance pending Windows native-session test.
- Unit tests cover the real backend catalogue, filtering, correct source counts, disabled scanner and absence of write permissions.
- This experiment does not support installing or updating software, and must not be merged as if it does.
