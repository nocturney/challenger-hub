# Challenger Hub 2.4.0 - portable releases, multi-source tracking and expanded discovery

Date: 2026-10-09. Challenger Hub remains a working name. Native OS executable/bundle identities remain Craft Update Center until approved renaming.

## Delivery
- 47 catalog records: 12 unchanged Storytold Craft apps and 35 independently curated challengers. Eleven additions from the supplied research: LosslessCut, Gyroflow, Synfig, Helio Sequencer, Cardinal, Goxel, CloudCompare, MeshLab, F3D, Mayo and Olive.
- 32 of 35 independent projects have GitHub release metadata. When rate-limited, GitHub Atom may detect a newer unverified tag; it cannot bypass checksum validation or approve that update.
- Install/update in the catalog is supported by 9 reviewed Windows x64 and 8 Apple Silicon/macOS release adapters. Downloaded archive SHA-256 is always compared with digest published in official GitHub release metadata; macOS installs additionally check bundle code signatures. Every install/update requires confirmation. No new vendor software was installed by the 2.4 production rollout.
- Separate Download portable buttons: 21 on Windows (including portable ZIPs from all twelve Storytold projects) and 3 on macOS. Exact SHA-256 verified files are saved to D:\Downloads\ChallengerHub\Portable (Windows) or ~/Downloads/ChallengerHub/Portable (Mac), without automatically extracting, installing, or executing them.
- Project maturity is separately color-labeled as Stable, Beta/RC, Alpha, Early/Experimental, Stage unverified, or Dormant/watchlist. Bleeding edge is a separate research/risk channel for six early projects; it is not interchangeable with maturity.
- Details identify other catalog projects that challenge the same proprietary product, display source/release metadata, caveats, and installation/package limitations.
- Redundant theme selector removed from Settings. The header retains appearance controls. Settings now supports release check cadence, automatic checks, and including/hiding early-stage projects. English only.

## Verified
- Both local backends and both native wrappers updated to 2.4.0 and running in the interactive user session.
- Twelve existing Craft programs remain detected on Windows and Mac; 35 challenger records, 2 source configs and zero active installer jobs.
- Windows production Chromium QA passed: 47 cards, creator filtering, similar-alternative clicks, portable confirmation, release metadata, color-coded maturity, bleeding edge and dormant status, Settings, responsive 930/430/360 px, no JS exceptions or horizontal overflow.
- Windows sandbox PhotoDemon and Mac sandbox Compositor successfully downloaded, SHA-256 verified, installed and updated with backup to QA-only paths.
- Separate portable downloads tested for Windows PhotoDemon ZIP and macOS GodSVG ZIP. Those files were saved in user Downloads and were never installed or executed.
- All 9 supported Windows portable install adapters passed real asset inspection. Eight Mac DMG/app adapters passed validation. Auto-install of GodSVG (Mac archive missing .app), REAL Video Enhancer (Mac archive missing .app), PixiEditor (unsigned nested code), and Friction (unsigned Mac app) was blocked in preference to offering unsafe install.
- A GitHub-published digest establishes publisher-artifact integrity, NOT protection against compromised or malicious upstream software. Most featured apps have not undergone functional GUI testing.

## Files and recovery
- Canonical sources: challengers.json, sources.json, release-index.json, adapters.json, portable-assets.json
- Backend/workers: server.js, challenger-core.js, Install-Challenger.js
- Existing Craft install scripts remain unchanged.
- Backup-before-v2.4 holds prior frontend/server source and catalog. NativeWindows/backup-native-v2.3.0 and NativeMac/backup-native-v2.3.0.app hold prior GUI shells. QA runs and screenshots live in Sources-v2.4.
- Broad automatic discovery of all GitHub developers does not yet exist: sources are curated and releases auto-checked for the selected repositories.

## Branding
AltForge is already an existing public open-source sideloading project (legeling/AltForge), while ALTAFORGE has pending software-category trademark applications in Canada and the US. Do not present AltForge as an available cleared product name.

## Optional next steps
- Favorites/watchlist and per-project release alerts.
- Verified signature/notarization state per platform, plus ability to pin previous releases and recover from bad updates.
- Additional specific MSI/setup EXE or Mac app adapters only after per-project safety validation and OS-level testing.
- More independent reviewed project sources, without padding default catalog with obvious mainstream tools or code libraries.
