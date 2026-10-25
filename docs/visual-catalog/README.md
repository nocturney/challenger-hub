# Challenger Native — source-verified visual catalog, 25 Oct 2026

This is an incremental, **developer-preview** inventory based on a one-shot read
from the real Preview12 backend (181 projects), not a fabricated catalog.

| Metric | Native before | This change |
| --- | ---: | ---: |
| Native icons tied to exact project and official upstream | 22 | 22 |
| Projects with genuine embedded screenshots | 3 | 16 |
| Genuine embedded screenshot frames | 3 | 50 |
| Projects with no embedded screenshot | 178 | 165 |
| Projects with no embedded icon | 159 | 159 |

All 47 newly imported Craft UI screenshots were **already source-reviewed and
committed** under `tools/preview-build/media-source/assets/media/craft/`.
This change embeds their unmodified exact bytes in native Slint and validates
SHA-256 and byte counts, image dimensions, source URLs and license metadata.
The three previously approved curated screenshots are retained.

- `inventory-20261025.{json,csv}`: all 181 project IDs, source identity,
  category, logo/preview coverage, source-reported licenses, manifest links,
  screenshot SHA-256, screenshot count, imported bytes and exact UI integration.
- `missing-media-20261025.json`: actionable missing-media list, including one
  source-approved icon not yet embedded, with neutral fallbacks otherwise.
- `ui/APPROVED_GALLERY_INDEX.json`: per-image original source link, license,
  image dimensions, caption and digest; generated from the approved manifests.
- `sync-approved-gallery.mjs --check`: offline CI gate for exact image bytes
  and generated Slint/Rust mappings; no hotlinks, downloads or AI imagery.
- `create-media-inventory.mjs --snapshot <validated-sidecar-json>`: rebuilds
  the inventory against a genuine 181-project read-only source snapshot.

Developer-preview UX now includes a third verified Explore card on wide windows,
preview thumbnails and summaries in Results, and a keyboard-accessible
multi-frame dossier gallery with source links for each reviewed screenshot.
An empty project remains clearly marked: no screenshot, not a counterfeit.

**Guardrails:** source catalog membership never implies permission to install;
no Production or Preview11 changes, automatic installation, user profile edits,
third-party installs or paid API calls. This alone does not authorize a stable
release or constitute full visual QA on every OS / screen size.

**Next coverage wave:** prioritize top Explore/Search entries and each of the
17 disciplines, then the remaining 165 projects without screenshots. New
assets must pass exact identity, source provenance, rights/attribution, SHA-256,
size/dimensions and genuine OS visual QA before inclusion.

## Real Mac Slint window QA, 25 Oct 2026

The following are **native window-targeted captures** from the running
Rust/Slint preview on MacMiniOffice2. No full-desktop/user windows, AI mockups
or browser captures were included. They show the real read-only Preview12
catalog, source-verified thumbnails and the four-frame PdfCraft gallery.

![Authentic Craft screenshots and responsive results, native Mac](qa-macos/01-verified-results.png)

![PdfCraft official UI screenshot, gallery 1 of 4, native Mac](qa-macos/02-pdfcraft-gallery.png)

The Results screenshot follows the responsive column adjustment: the verified
image remains prominent and the tool/discipline source facts remain legible
at a normal Mac preview window width. This is visual evidence for Mac only;
interactive Windows/Linux layout still requires platform-specific acceptance.
