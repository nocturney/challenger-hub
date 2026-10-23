# Challenger Focus 4.0 + Orbit — Windows Native Single-EXE Preview 7

A functional native-desktop update of Preview 6, not a mockup. This preview addresses three user-reported issues: missing Hub version/self-update checks, scroll-heavy first window, and missing independent-project icons/screenshots.

## Changes implemented

1. **Visible version and self-update discovery:** an always-visible `v4.0.0 · Preview 7` identifier plus **Check Hub updates** in the header. The locally bundled `desktop-manifest.json` supplies the true current build. A read-only local GET `/api/hub-update` queries official `nocturney/challenger-hub` Windows TEST Pre-releases only. Every suggested release must have the exact versioned official EXE asset, matching official URL and GitHub SHA256 digest, with no drafts/stable-channel mixups or untrusted links. The user can open the official release page; the Hub never downloads or installs itself automatically. Existing authenticated `gh` is reused on Chris, falling back to anonymous official GitHub API on other machines. No credentials embedded.
2. **Native display and viewport fit:** WinForms starts maximized against the Windows working area, rather than using a rigid 1400×920 window. CSS has a denser above-the-fold home search, smaller header, more compact directory rows at 700–980 px viewport heights, with responsive breakpoints. Scrolling remains for *long result lists*; the search and first actionable categories are visible at first launch.
3. **Official-source media resolver:** 10 pre-approved and SHA256-pinned app logos + 3 bundled genuine screenshots still have the highest priority. For other independent projects, a new bounded server-side resolver parses their **own official GitHub README** and accepts only strong screenshot/interface candidates stored under their **own source repository** and checked by MIME, image magic and dimension/size limits. It links to the precise GitHub README and never opens third-party network images from the browser. Source-backed screenshot results were verified for **Infinite, Gyroflow, Mayo and Baserow**, increasing the verified genuine UI screenshot coverage to at least 7 projects under network connectivity. More images are found lazily when other project pages open; absence is not hidden or replaced by fabricated screenshots.
4. **Real owner imagery as a truthful fallback:** public GitHub GraphQL returned source-verified creator avatar links for **132/152** independent projects. The runtime serves those images through a bounded and allowlisted localhost proxy as **creator avatar — not official product logo**. Official packaged product logos always take precedence. It never claims a category icon or owner avatar is the product's original logo.

## Actual QA evidence (23 October 2026, Chris Windows)

- Genuine attached [1366×768 home screenshot](home-1366x768.png) and [1200×700 viewport](home-1200x700.png), showing the search and category navigation within the initial viewport.
- [Actual Baserow project dossier screenshot](baserow-official-readme-1366.png), with genuine image obtained from `baserow/baserow` official README and source-credit link.
- Dedicated real-browser tests at widths **1590, 1366, 1200, 430** (and responsive base QA at 1040, 768, 320), zero horizontal overflow, no simulated content, 0 browser JS errors, no unexpected external browser requests.
- Real `/api/hub-update` reports this packaged desktop version and the current published official release. Verified test versions cannot silently install a downloaded EXE.
- 50/50 Node regression/unit tests across original Focus/Orbit, update check release strictness, repository media provenance, source-scan functionality and UI contracts.
- 10/10 end-to-end responsive dark/light/source screenshot UI scenarios, safe Verify and a real network Scan button click; separate viewport/version/README media browser acceptance also passed.
- Windows interactive non-admin Chris session: standalone EXE starts its own private Node + WebView2 GUI on random 127.0.0.1 port, with bounded private write-session token; no permanent Windows service or Task Scheduler job left after QA.
- All 14 managed + 152 reviewed independent entries remain intact; research candidates stay blocked from installation. Installation paths and detected versions are never included in the distributable seed snapshots.

## Remaining limits and security gates

- A GitHub creator avatar is **not** a product logo. Missing official logos still need source verification; official README images are shown only when the on-demand author-source check succeeds (and might require network).
- The independent project **membership** still comes from October 10 human curation, although GitHub repository facts were refreshed October 23. No newly found unreviewed project is automatically install-approved.
- Preview7 only covers Windows; macOS remains on Preview4. Self-update is **discovery + official release navigation**, **not silent installation, replacement or rollback**. Real third-party install/update/rollback acceptance is still pending.
- Windows EXE is not Authenticode signed, so SmartScreen warnings are possible. WebView2 Evergreen must be present. No Production rollout, merge, remote-fleet orchestration or unattended system modifications.

Source: `hub-updates.js`, `repository-media.js`, `registry-live.js`, `server.js`, `tools/desktop-build/{hub-update-ui.js,live-project-media.js,viewport-fit.css,build-runtime.cjs,qa-visual7.cjs,build-onefile-windows-preview7.cjs}`.

Draft PR and the verified SHA256 of the single released EXE are recorded in GitHub Release metadata. Previous releases are unchanged.
