# Challenger Hub UI 2.5.5 — explicit inspector lifecycle

## Problem
The details inspector automatically selected the first catalog item and appeared in desktop Grid view even before user interaction. Its Close (×) control only removed a mobile/overlay class, leaving the persistent desktop column visible. The stale selection could return after periodic catalog renders.

## Resolution
- Initial load, refresh, sorting, filtering, searching and switching Grid/List views do not implicitly select or open an application.
- Only an explicit application-card interaction (mouse, keyboard Enter/Space, card Details, related app) opens the inspector.
- Grid on desktop uses an adjacent inspector only while selected. When closed, cards expand into the entire available catalog area.
- At widths of 1250px or less, and for desktop List view, the inspector opens as a dialog overlay with an accessible modal role.
- Close ×, Escape and modal scrim dismiss the inspector, clear selectedRepo, remove stale selection highlighting and return keyboard focus to the selected card when possible.
- Opening identifies the selected application by name, icon and status; the selected card gets an emphasized outline and marker.
- If a selected project disappears because of a filtered result or refreshed catalog, the inspector closes rather than silently selecting the next project.
- The UI version marker is 2.5.5. The source/release polling and installation engines are untouched.

## Test plan
Local QA on Windows and macOS across widths 1760, 1590, 1250, 1024, 900, 650, 430, 360 and 320. Checks include no initial inspector, no horizontal scroll, full-width grid when closed, explicit app selection, correct displayed title, × close, Escape close, Enter open, restored keyboard focus, multiple poll cycles, scrim close, Grid/List parity, global search, facet and status filters, and unchanged installation boundaries.

## Deployment boundary
Promote only app.js, index.html and style.css, with per-device SHA-256 snapshots and rollback. Do not restart background services or downgrade the OS-specific API/scanner: the UI is version 2.5.5, while backend versions remain Windows 2.5.3 and macOS 2.5.2 until a separate reviewed release.
