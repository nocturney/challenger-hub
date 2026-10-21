# Challenger Hub

A localhost desktop catalog for discovering independent alternatives to familiar software on Windows and macOS. The repository contains reviewed **source**, not a live deployment or an installer marketplace.

## Current status

- **Source UI 2.7.0 on `main`:** Explore / Catalog focus modes and progressively revealed filters, built on the 2.6.0 discovery UI and 2.5.9 operations UX. Its source and staging were tested on both platforms; **a live 2.7.0 deployment is not established by the Git merge**.
- **Last documented production baseline:** 2.6.0 discovery UI on Windows and macOS; backend health versions 2.5.7. Platform source-scanner implementations still have differences. Check host-specific deployment receipts for any newer live state.
- **Catalog:** 12 Craft apps and 152 independent projects (164 entries). The 73 research-only imports are explicitly unverified and cannot be installed just because they appear in search.
- **Source tracking:** release information from GitHub, GitLab, KDE Invent and Codeberg is discovery data, not package authorization.

## Development

Validate the JavaScript source and available tests before promoting changes. Run staging on a separate localhost port with `CHALLENGER_DISABLE_SCAN=1`; do not copy a Git checkout over a live installation.

```sh
node --check server.js
node --check app.js
node --check challenger-core.js
node --test tests/*.test.js
```

Installer actions require separately approved adapters, verified packages and explicit operator authorization. Git pushes do **not** automatically deploy to either host.

## Documentation

- [2.7.0 workspace UI and deployment boundary](docs/WORKSPACE_UI_2.7.0.md)
- [2.6.0 discovery UI](docs/DISCOVERY_UI_2.6.0.md)
- [Operations, safe staging and rollback](docs/OPERATIONS.md)

The `main` branch holds the reviewed source; use a separately reviewed deployment process for the Windows and macOS installations.
