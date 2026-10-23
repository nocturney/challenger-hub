# Challenger Focus Desktop — Windows Preview 10

**2026-10-23 | Native single-EXE test release.** Stacked draft after Preview 9. No Production merge, no macOS deployment or new installer permissions.

## Product correction: discovery is the purpose, not a side channel

The previous profile-completeness filter (long summary, confirmed platform, licensed data, commercial comparison) **incorrectly hid software that might be the reason someone uses Challenger**. The user explicitly requested the opposite.

**Preview 10 removes the discovery gate.** All source-linked entries remain visible, findable in the same search, and eligible for category filters, including projects with incomplete information, old GitHub activity, or archived repositories. Such facts are *visible labels* and evidence gaps, never deletion rules.

The actual default working directory now contains:

| Source | Entries |
| --- | ---: |
| Creator's managed Craft products | 14 |
| Independently curated GitHub source projects | 152 |
| New GitHub-checked additions | 15 |
| **Total visible / searchable** | **181** |

The added **New finds** filter selects all 15 new source records. These are integrated into the **same core search, directory and full dossier pages**, not hidden behind another section or opt-in toggle. Refreshing the local data twice preserved all 15 records and did not introduce duplicates.

The historical 14 include SolidCraft, Graphite, FreeCAD, OpenSCAD, OrcaSlicer, DCC-MCP Core, Blender MCP, FreeCAD MCP, Kdenlive, ComfyUI, text-to-cad, Varve, FundaCAD and OpenCut. **GenOffice** is the 15th candidate. Its [official repository](https://github.com/genspark-ai/genoffice) is active, Apache-2.0, with confirmed non-prerelease **v0.12.29** published 2026-10-22. It is a real Docs/Sheets/Slides/PDF editor and local CLI/MCP candidate. AI provider access may carry separate subscription/API charges, so no claim of unconditional free AI. It is **not approved for automatic installation**.

**Trust dimensions remain independent:** upstream source identity, product detail completeness, archive/activity observations, verified executable/installer rights, and installation ownership. A missing platform field is displayed as missing information but does **not** exclude the project. Archived Flowise and a partially documented Dune3D entry are searchable normally, with explicit warning/context. Unsafe installation actions remain disabled; no research record is granted install adapters.

## Quiet, stable native chrome

- Removed the permanently changing **LOCAL DATA** connection text from the visible header (internal health check remains available through backend and explicit error notices).
- Removed the **Hub is current** timestamp chatter from the interface.
- Relocated **v4.0.0 · Preview 10** and **Check updates** to a compact fixed-height footer, with **no automatic GitHub update check at startup**. The user can check manually; a new release is explicitly linked to an official GitHub Release, while a current release gets a short one-time notice.
- Fixed footer layout and protected header placement at 1100×760, 920×600, 780×540 and 430 px. Existing normal-window sizing (not maximized) is retained.
- Genuine Craft/independent icons, original screenshots, offline source archive and catalog remain intact.

## Real executed acceptance

- **75/75 Node regression tests** covering all previous release/security/media scenarios plus preview10 discovery/GenOffice/footer tests.
- **10/10 original browser-integration scenarios** from the actual packaged private Node engine.
- Additional browser QA confirmed 181 entries, 15 new source records, archived source visible, incomplete source visible, GenOffice searchable and opening a genuine source-linked dossier with **zero install controls**, no startup hub-check network calls, fixed footer, multiple window sizes, no JavaScript errors, no unexpected external browser image loads or unsafe writes.
- Original Craft images and their source links validated in the full package for CADCraft, PhotoCraft, FigCraft and PDFCraft, including unpublished AniCraft shown without a fictitious product logo.
- **Real first launch:** `ChallengerFocusDesktopPreview10.exe` launched with no existing Preview10 runtime directory, as non-elevated `CHRIS\\Chris` Session 1. The native log confirmed private Node start, WebView2 initialized, `Desktop UI navigation: True`, and the expected 14 managed + 152 existing source + 15 additional front-end candidate entries. Transient launch and frame-check scheduled tasks were removed.
- **Real Win32 frame test executed within logged-in Chris session:** **1100 × 760**, `maximized:false`.

The validated Windows EXE uses a single executable, preserves SHA256 integrity checks on the packed runtime, and requires the usual Windows WebView2 runtime. It remains **unsigned**, so SmartScreen can warn; the self-updater still redirects to official release rather than replacing a running executable. Third-party installer/rollback acceptance and a new Mac package are outside this test release.

## Visual QA screenshots

[GenOffice real dossier](genoffice-source-linked-dossier.png) · [New finds in primary catalog](all-15-new-finds-searchable.png) · [Small window with quiet footer](no-local-banner-footer-780x540.png).

**Current draft branch:** `feat/focus-preview10-quiet-footer-genoffice`, stacked on Preview9 branch `fix/focus-preview9-extraction-catalog-health`.

**Release target:** `v4.0.0-orbit-preview.10` · `ChallengerFocusDesktopPreview10.exe`. Native QA verified SHA256: `0eb9da96e2eea33a53fab711addfca50cf9efa36cc8f6ee2e0baeb6c56c00ff6`.

### Future policy

Do not automatically hide candidates because they are small, new, undocumented or quiet. Preserve source provenance and clear missing fields. Only *installation/update execution*, not discovery, requires a separate strong allowlist. Do not multiply UI subsections to conceal the very projects the Hub is intended to uncover.
