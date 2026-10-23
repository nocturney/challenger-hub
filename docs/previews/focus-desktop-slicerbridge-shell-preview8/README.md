# Challenger Focus Desktop — Windows ONE-EXE Preview 8

**Native working software, not a mockup.** Stacked on Preview 7. The active installer engine and security gates are preserved; this draft stays separate from Production and macOS Preview 4.

## User-requested corrections shipped

**Window size and first viewport**
- Instead of Preview 7's forced maximization, Windows starts a **normal, centered, working-area-constrained window**, initially **1100 × 760** on Chris. Native Win32 measurement confirmed `IsZoomed=false`.
- The header, Hub version, search and footer stay accessible as the window shrinks. Only long category/document lists scroll internally. Tested **1100×740, 920×600, 780×540**, plus 1366×768/1200×700 and responsive 430 px.

**Information people can actually use**
- Refreshed public GitHub repository facts for **152/152 independent projects**: official repository description, released version where published, repository push date, stars, primary language, homepage, SPDX license if GitHub establishes one, project topics and last check.
- Curated profile quality is independent from installation permission: **72 documented independent profiles**, **7 reviewed entries still missing critical platform/info**, **73 research candidates**. The default Browse presents 72 documented + 13 already released managed Craft apps = **85 useful profiles**; **81 others** (7+73+one unreleased AniCraft) remain accessible via an explicit **Show research** control.
- Research isn't deleted; repo credibility, platform verification and installer approval remain distinct. GitHub license unknown means **unknown**, not a guessed open-source grant.

**Real logos and real screenshots across the entire catalog**
- **Craft suite:** 13 app-specific licensed icons and **47 actual app source screenshots** bundled with attribution, SHA-256 pinning and clear creator credit. The trademark of the ArtCraft launcher/company itself is not copied. One unreleased app (AniCraft) is not pretended to have published assets.
- **Independent projects:** authenticated GitHub recursive tree and README audit for **all 152** source repositories, with original candidate files from **115** of them. Human-selected path shortlist was fetched and checksum-verified: **36 distinct project repositories**, **46 pinned source screenshots** and **16 pinned app icons**. One unsupported proposed icon source was rejected. Unlike Craft images, these third-party image bytes are **not bundled/rehosted in the EXE**.
- The UI retrieves these images only when needed from their own pinned GitHub commits, validates the exact SHA-256, and returns pixels over private localhost WebView2 endpoints. Validated bytes can be reused from a version-scoped, per-user on-disk cache. Source permalinks are shown on each image. A missing image is never faked.
- Existing three original screenshot and ten icon asset approvals remain in place.

**ArtCraft Launcher engineering comparison**
- Reviewed [official ArtCraft Launcher](https://github.com/storytold/craft-launcher) at pinned commit `9419d89`, with [source-based comparison](LAUNCHER_COMPARISON.md).
- **Adopted its typed release-status distinction**, e.g. no published release vs offline/cached unavailable vs installed update vs no compatible asset.
- **Adopted conservative installation ownership principle**: detecting a local executable is not proof Challenger installed it; `ownerVerified:false` and `mayAutoReplace:false`. This metadata does not silently grant new installer access.
- Deliberately avoided rewriting the existing stable WebView2 engine in Rust/egui, making a nonexistent launcher CLI contract, or copying an updater helper before we have signed builds and rollback QA.

## Executed tests / reproducible visual evidence

- **66/66 Node regression/unit tests**, including original source scanner, media provenance, install status, Hub update selection, privacy and platform logic.
- **10/10 real Chromium Focus/Orbit scenarios** plus additional desktop-fit, quality filter, Hub version, source-pinned Baserow imagery and Craft gallery acceptance. **0 JS errors**, **0 unexpected browser network requests**, **0 unauthorized state-changing POSTs**.
- **Final single Windows EXE** with bundled original Node/WebView2 engine and **147 integrity-hashed runtime files**, tested from the exact released candidate: **95,778,735 bytes**, `SHA256 7631a8946f3ba925dc03908dc7c9ca9320691184f410fb1b7f0a7fea92997adf`.
- Browser gallery verifications: CADCraft, PhotoCraft, FigCraft, PDFCraft. Verified source-bytes HTTP responses for Baserow, Material Maker, Frappe CRM, Actual Budget; vetted icon responses for Compositor, Material Maker and Zed.
- Windows GUI validation uses a real interactive CHRIS\\Chris user session, not a simulated in-browser mockup. No persistent scheduled tasks or services.

[Normal opening window 1100 px](challenger-viewport-1100x740.png) · [Reduced window 780×540](challenger-viewport-780x540.png) · [Full opening 1366 px](home-preview8-1366x768.png) · [CADCraft genuine screenshots](cadcraft-gallery-real.png) · [FigCraft genuine screenshot](figcraft-gallery-real.png) · [Baserow pinned GitHub source screenshot](baserow-source-pinned-dossier.png) · [Research entry explicitly opened](research-opt-in-dune3d.png).

**Complete source audit:** [MEDIA_AUDIT.md](MEDIA_AUDIT.md) and [per-repository scan result](source-media-audit.v1.json).

## Release and limits

Windows-only **Preview 8** (one EXE). No production merge, no macOS alteration and no unattended install/update/removal. Need WebView2 Evergreen, and the EXE is still unsigned (Windows SmartScreen may warn). Self-update still opens a verified official GitHub release but does **not** replace its own running EXE; third-party install/update/rollback end-to-end acceptance remains pending. Any upstream screenshot missing from the source audit should be verified through its owner’s official website or documentation, rather than invented.

Branch: `feat/focus-slice-shell-project-quality-preview8`; stacked on `feat/focus-desktop-selfupdate-fit-media-preview7`; Draft PR. Source-media registry and detailed audit included; one versioned GitHub prerelease EXE.
