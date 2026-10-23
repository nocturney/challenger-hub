# 152-project source-media audit and curation — 23 October 2026

## Method

Authenticated **read-only GitHub API** requested the full recursive `HEAD` repository trees and READMEs of **all 152** independent catalog projects. Files were classified as *candidates* by conservative source-path scoring. One repository tree was truncated; no tree lookup had failed. This is source discovery, not a substitute for checking who owns a file or viewing its content.

Audit report (152 project entries): [source-media-audit.v1.json](source-media-audit.v1.json). Scanner: `tools/desktop-build/audit-all-project-media.cjs`. Use this report when reviewing another batch: do not rescan everything just because an existing asset is missing from the visible directory.

| Metric | Count |
|---|---:|
| Official project repositories scanned | 152 / 152 |
| Repositories with any candidate images | 115 |
| Repositories with candidate app icons | 94 |
| Repositories with candidate screenshots in source tree | 59 |
| Repositories with README-linked image candidates | 33 |
| Repositories without eligible candidates in this scan | 37 |
| Repositories with truncated source tree | 1 |

## Actually source-pinned and delivered by Preview 8

A separate, manually selected set of *product-relevant file paths* from the audit was then fetched from each **exact reviewed project GitHub commit**. The actual bytes were compared to the Git tree blob hash, validated for image type/size/dimensions, and locked to SHA-256 in [independent-media.v1.json](../../../independent-media.v1.json).

- **36 distinct projects** with validated original image sources
- **46 independently source-pinned interface screenshots**
- **16 independently source-pinned application icon candidates**
- **One rejected asset** (OpenPanel icon path not in initial vetted tree shortlist), not installed or accepted
- Grida’s `editor/public/brands/adidas/logo.png` and similar customer/demo marks deliberately **not** used as Grida’s own logo

Unlike bundled Craft media, the 62 external project images are **not copied into GitHub Releases**. The local app fetches exact GitHub-commit URLs only when needed, verifies bytes again against immutable SHA256, saves an optional per-user verified cache, and serves images back to its own WebView2 over `127.0.0.1`. Any rejected or unavailable image falls back to explanatory text or a neutral icon.

**License note:** Source presence establishes origin, not permission to republish. Each third-party media image remains owned/licensed by its original project, and is attributed by a direct permalink. The EXE includes vetted metadata and thumbnails are fetched on demand, not redistributed as bundled media. Where no license could be verified, the UI never claims otherwise.

## Craft Apps, handled separately and fully

The official creator's [ArtCraft Launcher app-icons](https://github.com/storytold/craft-launcher/tree/9419d89/assets/app-icons) provided **13 app icons**; [craft-launcher-assets v1](https://github.com/storytold/craft-launcher-assets/tree/v1) plus independent pinned FigCraft/PdfCraft project sources supplied **47 genuine screenshots**. Their bytes and appropriate notices are included in the local native EXE; ArtCraft's separate company mark/wordmark is not used.

## Remaining work

The 37 repositories without candidates may store UI media on official websites, docs CDNs, releases or desktop package icons; absence from Git tree **does not prove there are no images**. That requires source-by-source evaluation, checking each domain’s ownership and redistribution rights. Avoid invented screenshots, manufacturer logos from sample documents, arbitrary Google Images results, and self-invented product capabilities.

Installer approval, installer availability and editorial profile completeness remain separate from media quality. Research-only entries are not automatically promoted to installable because screenshots were found.
