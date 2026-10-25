# Challenger Hub — Quiet Premium native UX pass

25 October 2026 · Draft, stacked on PR #31 · not approved for public release or merge.

## Intent

Present genuine software as products rather than a repository report. Keep the existing
Discover → Browse → App → My Software flow, 181 source-backed projects,
29 projects with original screenshots, 152 factual identities and 30 approved
icons. **No** synthetic preview, logo, app UI, reviews, ratings or install claims.

## Shipped in this branch

- A native Slint `QuietPremium` token global defines control/card radii, restrained
  hover/selection palette, shadows and 160–180ms motion.
- Browse cards separate from one another; source-verified screenshot or factual
  identity stays untouched. Cards now have clear title, creator, discipline chip,
  summary, platforms and a view action. A hover/press effect and focus ring signal
  that the whole card is actionable. Only an interacted card casts a shadow.
- Top navigation has pill-like selected/hover/pressed surfaces; browse search gets
  restrained shadow and a consistent radius.
- Identity app details use an editorial typographic hero. Creator, platform, type
  and upstream source remain factual and accessible.
- Official-detail gallery gets a subtle card elevation. Technical disclosure
  receives quiet state feedback but stays collapsed until requested.
- Motion is gated by a host-provided reduced-motion preference. Native host checks
  macOS accessibility defaults, Windows SPI_GETCLIENTAREAANIMATION or GNOME
  animation preference where available. `CHALLENGER_REDUCED_MOTION=1` always
  disables the animations; `=0` overrides OS detection for QA.
- No new runtime/package dependencies, paid APIs or external assets.

## QA gates

- `node tools/ui-bench/slint-rust-host/verify-rich-minimalism.mjs` checks
  tokens, input states, reduced motion and the no-fabricated-media constraint.
- Existing product-first, visual-policy, SHA/media-credit and installer policy
  tests remain in force.
- Native Rust/Slint build, a genuine window capture at 820px and 1180px,
  keyboard focus/activation, dark mode and startup-to-ready readings are required.
  The previous single Mac QA reading of **14.718 seconds** is only a reference,
  not an established baseline; compare repeated runs before claiming a performance gain.
- A previously attempted two-column dynamic grid caused CPU/start instability.
  This pass keeps the stable virtualized one-column ListView. Do not reintroduce
  the unverified grid merely to satisfy screenshot aesthetics.

## Measured native Mac evidence

Authentic screenshots of the modified Rust/Slint window on MacMiniOffice2,
running the existing read-only Preview12 backend:

- [Browse with authentic Craft UI and product cards](qa-quiet-premium-macos/01-browse.png).
- [Factual Composa identity dossier](qa-quiet-premium-macos/02-factual-app.png).
- [Source-verified Dune 3D application gallery](qa-quiet-premium-macos/03-official-app.png).

Checks on the actual modified branch and binary:

- Rust \`cargo test --locked --offline\`: 36/36 passing.
- Node read-only/installer policy tests: 16/16 passing.
- Rich Minimalism, product UX, visual media and 100-asset rights ledger: PASS.
- Native \`--smoke\` with reduced-motion preference active: PASS in three
  successive runs with startup-to-ready **17.556s, 13.886s and 13.928s**
  (median **13.928s**, range **3.670s**). PR #31 previously recorded
  **14.718s** in a different single run; this is *not* a controlled
  before/after comparison. Startup remains slow; no performance improvement
  is claimed until repeated matched-baseline profiling attributes the time.
- Native \`--qa-resize\` with reduced-motion preference active: PASS at OS
  logical widths **820** and **1180**, navigation retained, installer untouched.
- Three unaltered, window-targeted \`screencapture -l\` PNG files preserved.

The screenshots show a cleaner product hierarchy, especially at Browse and
factual identity; they do **not** constitute broad Windows/RTL/IME approval.

## Release boundary

Only a stacked Draft PR based on PR #31. No merge, production package,
side effects/installer execution, third-party installation or physical action.
Public distribution remains blocked on media-specific copyright/trademark rights,
which attribution and a source-reported repository license alone do not grant.

## Work still required

Real native Mac and Windows visual acceptance, full keyboard/RTL/IME and
accessibility review, repeatable performance profile, grid exploration in a
separate isolated experiment, rights review and final user approval.
