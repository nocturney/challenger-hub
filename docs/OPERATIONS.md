# Operating boundaries
The active production locations are D:/Velvet/Installers/CraftSuite/Center on Windows and
~/Library/Application Support/OfficeOps/CraftSuite/Center on macOS.
These directories are *not* Git checkouts. Do not pull or clone over production.
Keep working copies and candidate servers isolated on a separate port.
Before deployment verify zero active or queued installer jobs; snapshot affected files with SHA-256.
Do not silently change any approved adapters, URLs, package digests or managed installation records.
Run cross-platform browser/API/unit QA before promoting a release.
Rollback requires stopping only a verified production listener and restoring all changed files.
Release metadata sourced from GitLab/Codeberg/KDE Invent is informational unless independently verified.
Manual GitHub Actions only: no automatic recurring build minutes are consumed.
The original operational handoff remains in Google Drive and is not duplicated into this Git repo.
