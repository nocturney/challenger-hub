# Issue #36 — Native accessibility, scaling and bidirectional input

Branch: `feat/challenger-native-a11y-issue36-20261025`, based on merged PR #35 / `release/preview11-modern-app` (`9a71d91`). Development review only, not a user installation or public release.

## Focused changes

- Add opt-in 175% / 200% native text scale values while retaining the 100%, 125% and 150% options and safe schema-v1 default. Save paths remain unchanged, source images and icons are not scaled or fabricated.
- Use larger scrolling card rows, descriptive text area, expanded domain/CTA controls and clipped-label-safe compact navigation. Avoid a new grid, WebView, CSS, package, performance-sensitive animation or new data source.
- Allow the Preferences native popup to use available window width/height and its existing ScrollView; preserve accessible names even when a high-scale sidebar label is shortened.
- Set native search LineEdit alignment to `start` (not hard-coded LTR), mark search inputs with the `search` role, and include a mixed Hebrew/Latin/digit query QA route. This does not simulate actual OS IME composition or authorize full Hebrew UI localization.
- Extend existing Windows UIA QA expectations to the 175/200 radio buttons; avoid changing real preferences, live installations or machine accessibility settings.

## Verification and limitations

- Local macOS Rust `cargo test --locked --offline`: **39/39 PASS** (including source-wide font-scale/role regression).
- Node read-only bridge/install/updates tests: **20/20 PASS**.
- All existing Rich Minimalism, product-first, authentic media and rights-restriction source gates: **PASS**. Source-data and installer boundaries unchanged.
- Native screenshots / resize / Windows UIA checks for the new 200% implementation: **in progress**; will be added with exact observations. Do not treat static compilation as native acceptance.
- VoiceOver/Narrator/NVDA spoken-output and true IME composition: **NOT YET CERTIFIED**. Do not conflate source accessibility roles or UIA metadata with actual speech/input-method tests.
- Third-party media redistribution, notarization/signing and a public release remain separately gated. No auto-install/auto-merge/publish decision is implied by this development PR.
