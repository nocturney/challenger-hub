# Design Skill pilot — Browse legibility (2026-10-25)

## Purpose and scope
This is a measured first application of Velvet Design System's **evidence-first existing-product audit** to Challenger Hub's existing native Rust/Slint implementation. It does **not** add the private Design Skill repository as a runtime dependency. Source baseline: `release/preview11-modern-app`, commit `0476a351e23a3c2968f61e913ed47199f745d99d` (integrated PR #34); no attempt to revive closed PRs #26–33.

## Observed issue, not hypothetical redesign
Existing authentic QA captures `qa-quiet-premium-macos/05-browse-search-header.png` (wide), `06-browse-compact-820.png`, and `qa-native-preferences/06-browse-820-text-150.png` show the real one-column product list and native text scale. At the default 100% scale, low-priority labels (maker, discipline, platforms, and View details) are only 10–11px, while the summary is 12px. This is visually small relative to the card's generous media and whitespace; readability is improved without adding any decorative layer.

## Targeted code change
Only `tools/ui-bench/slint-rust-host/ui/catalog-card.slint` is modified:
- In wide-layout cards, discipline and platform 10→11px; maker and View details 11→12px; summary 12→13px with text field height 41→45px. On text zoom >=125%, the compact CTA uses `Details ↗` instead of `View details ↗`; >=175% uses `Details` without the arrow to preserve legibility in the fixed button width.
- Existing `TextScale.factor` remains active, including 125% and 150%; no font replacement, card count/grid change, runtime asset, CSS, animation, token, consent, installer, provider permission, or data-source change.
- Genuine Official or factual Identity media policy and original copy are unchanged. No invented app previews, logos, performance claims or screenshots.

## Verification performed
- `cargo test --locked --offline`: **39/39 pass** on MacMiniOffice2.
- `node --test tools/ui-bench/slint-node-bridge/{bridge,install-bridge,native-updates}.test.mjs`: **20/20 pass** after linking the pre-existing read-only Preview12 test runtime into the isolated worktree. First run had 4 environment-only ENOENT failures because the fresh worktree lacked that runtime; no test or production code was changed to bypass this.
- `verify-rich-minimalism.mjs`, `verify-product-first-ux.mjs`, `verify-native-visual-policy.mjs`, `verify-native-media.mjs`: **pass**, including 181 real records, 29 projects with official screenshots, 152 factual Identity, zero invented media, and public asset-redistribution gate remaining blocked.
- `git diff --check`: **pass**.

## Visual/acceptance checklist
- **Done:** five genuine post-change native captures: wide/default, 820px compact, 820px/150% before and after the adaptive CTA, and dark. Inspected same Craft query. Only the minimal text/CTA before/after evidence crops are proposed for the public PR; full screenshots containing upstream application artwork stay in the local QA workspace.
- **Done:** real Preview12 read-only `--check-backend-only`: `RUST_HOST_LIVE_BACKEND_PASS` (181 entries, scanner off); `--smoke`: `FOCUS_NATIVE_GUI_PASS` (start-to-ready 14.012s in one run; not performance proof); native `--qa-resize`: `NATIVE_RESIZE_QA_PASS` at 820px and 1180px with navigation intact, no installer invoked. Light/dark screenshots inspected. At 820px/150%, the shortened `Details ↗` CTA is visibly contained in the actual rendered button; the card summary becomes more readable.
- This remains a **review-only candidate**, not product acceptance. No public release, auto-merge, installation, production deployment, or media rights bypass is authorized.

## Cross-stack audit adapted from XIAS, Impeccable, UI Skills and UI/UX Pro Max

This comparison **transfers goals, not tools**. All Chromium/DOM/Tailwind/React-only executors are NOT_APPLICABLE to native Slint; they are not reported as passing. Source of these methods: the Velvet Design Skills curated catalog. The existing Challenger project QA and policy remain authoritative.

| Design principle | Native evidence / method | Current verdict |
| --- | --- | --- |
| Product-first hierarchy / restrained polish (Impeccable, redesign) | Genuine 1210px and 820px macOS Browse snapshots from real Slint show screenshot/identity, title, maker, description and factual CTA; 1-column ListView preserves scrolling stability | OBSERVED_PASS for inspected Browse surface; no universal app-level conclusion |
| Real compact viewport / overflow (XIAS) | Four `screencapture -l` windows at wide, 820px, 820px+150%, and dark all completed; each is a native OS-owned window | OBSERVED_FAIL before correction; OBSERVED_PASS after re-capturing shortened `Details ↗` at 820px/150%. This is one CTA, not complete overflow coverage. |
| Text scaling / density (UI/UX Pro Max, UI Skills) | Only five targeted text roles increased; native `TextScale.factor` retained. Existing preferences support 100/125/150/175/200% | OBSERVED_PASS at 820px/150% for targeted CTA and summary in real screenshot; 175/200% and additional content lengths remain untested here |
| Contrast (XIAS) | Analytical WCAG luminance ratios of exact Slint card foreground/background source colors: summary 7.05 light / 10.15 dark, maker 6.09/7.59, category 4.58/6.96, CTA 5.75/6.53 | SOURCE_ONLY PASS for 8 sampled static background pairs at >=4.5:1, **not** every app state and not a full native accessibility certification |
| Keyboard action, focus and semantics (XIAS) | Code trace through `FocusScope`, `forward-focus`, `accessible-action-default`, named UI actions and native screen-reader roles; Rust unit source assertions | SOURCE_ONLY; physical Tab/Enter/Space walkthrough and OS accessibility inspector not yet performed |
| Reduced motion (XIAS) | `animate ... enabled: !root.reduced-motion` + host choice; rendered QA launched with `CHALLENGER_REDUCED_MOTION=1` | SOURCE_ONLY + native render with reduction enabled; repeated normal-motion comparison not yet executed |
| Click targets (XIAS) | Native hit area is the card action's parent `TouchArea`, not the text glyph. Actual OS hit rectangle/interaction needs independent testing | NOT_TESTED; no 24px PASS claim from source font size |
| Theme/high contrast and RTL/IME (XIAS) | Native light/dark screens inspected; existing high-contrast preference wired. No Hebrew-input screenshot or IME interaction in current scope | Light/dark OBSERVED_PASS for inspected Browse; high contrast / RTL / IME NOT_TESTED |
| Honest media/installer policy (Velvet + Impeccable data truth) | All existing source-gates passed including media provenance, 181 catalog entries, 0 generated artwork and public redistribution blocked | TEST_PASS for executed source and media gates; no installation or rights clearance inferred |

**Disposition:** no broad redesign; preserve existing tokens and performance-sensitive ListView, avoid fake previews and avoid adding web runtimes. Native 820px/150% CTA retest is complete with screenshot. Real Windows/AT acceptance, 175–200% stress scaling and performance benchmarking remain independent gates; no product release is authorized.

## Safe visual evidence (original window crops, no third-party UI images)

- [Before: 820px / 150%](qa-design-skill-pilot-macos/before-cta-820-150-safe-crop.png) — older text size and crowded `View details ↗` CTA.
- [After: 820px / 150%](qa-design-skill-pilot-macos/after-cta-820-150-safe-crop.png) — improved summary readability and contained `Details ↗` action.

The original unmodified full-window PNGs were inspected locally; they are intentionally **not** committed to this public repository because they contain third-party app screenshot pixels whose redistribution clearance is not established. The two crops are genuine subsections of the QA window, with the original upstream image excluded.
