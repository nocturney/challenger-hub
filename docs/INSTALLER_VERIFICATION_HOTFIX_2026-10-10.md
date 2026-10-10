# Installer release verification hotfix — 10 October 2026

## Problem and root cause
Challenger Hub's Windows queue reported historical HTTP 403 errors against GitHub. A later hotfix switched from anonymous GitHub REST lookups to the official `/releases/latest` redirect, but updates still failed at "Official release tag could not be verified". The Windows PowerShell installer piped the single-line Node result through `Select-Object -First 1`, and Windows PowerShell 5.1 reported `$LASTEXITCODE=-1` even while the valid tag `v0.4.0` was returned. The installer rejected that exit code before fetching the actual package. Reproduced by running the same command from `powershell.exe -NoProfile -NonInteractive`; the pipeless command produces exit 0.

## Fix
- `platform/windows/Install-CraftSuite.ps1`: remove `Select-Object -First 1` from the **Node release resolver invocation only**, preserving direct `$LASTEXITCODE`.
- `platform/windows/Install-WordCraft-Portable.ps1`: same. The unrelated pipeline used to locate the unpacked executable remains intact.
- `platform/shared/Resolve-CraftRelease.js`: prefer the official `github.com/storytold/{repo}/releases/latest` redirect; on failure, read a bounded **official** `releases.atom` feed with exact repository identity validation and stable semantic-release tag checks. No GitHub REST API token or new trust assumption. Never accept a mirror, an arbitrary redirect, a prerelease fallback, or an unapproved repository.
- Existing package checksum, Authenticode/Gatekeeper checks and installation protections are **unchanged**. No automated installer or Update all execution occurred during this repair.

## Verification
- Windows + macOS: offline mock tests covered official redirect, 403 to Atom fallback, identity rejection, prerelease rejection, untrusted HTML rejection and unapproved repositories. Live official lookups resolved WordCraft v0.4.0, CADCraft v0.4.0, PhotoCraft v0.6.0.
- Windows: validated both PowerShell sources using the PowerShell parser. Confirmed corrected pipeless Node lookup returns exit 0 for WordCraft/CADCraft/PhotoCraft.
- Windows: downloaded CADCraft 0.4.0 MSI (14,204,928 bytes) with the **same curl.exe client** as the installer. Its SHA-256 matched the official SHA256SUMS manifest, and Authenticode was Valid; **no install**.
- Windows: downloaded WordCraft 0.4.0 portable ZIP (56,241,935 bytes), SHA-256 matched the official manifest, inspected its extracted wordcraft.exe, verified Authenticode and version 0.4.0; **no install**.
- Live localhost service had 12 managed + 152 independent entries, an idle queue, and admin rights on Windows. Static launcher/API sources and the installation engine were not replaced.
- macOS PhotoCraft's previously reported code-signing/Gatekeeper failure is a distinct issue and must never be bypassed silently.

## Rollback copies
- Windows: `D:\Velvet\Installers\CraftSuite\UpdateReliabilityRollback-v2.5.8-windows-20261010`, containing the original three files and original/patched SHA-256 manifest.
- Mac: `/Users/chris/Library/Application Support/OfficeOps/CraftSuite/UpdateReliabilityRollback-v2.5.8-mac-20261010`, containing the original resolver and hashes.
- Original installation records and downloaded packages remain untouched. Revert only with a confirmed idle queue and checksum-validated backup.

## Platform deployment mapping
- Copy `platform/shared/Resolve-CraftRelease.js` to the CraftSuite parent folder on both Windows and macOS.
- On Windows also copy the two `platform/windows/Install-*.ps1` files into the CraftSuite parent folder.
- Changes take effect on the next new update job; no service restart is required.
- This is an operational installer fix. The frontend UI version is not bumped by changing external installer scripts. Repository main may differ from locally deployed research catalog content, so do not overwrite the live catalog while deploying this hotfix.
