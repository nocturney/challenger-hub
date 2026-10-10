# Signal Field 3.1 — a second, radically different direction

**Candidate only · not released or merged.** Screenshots from live-data, read-only Chromium staging on the Windows Chris host, October 10, 2026. No software was installed, updated or launched as part of the capture. All counts reflect the local data as of capture time and can change.

## Contrast against Observatory 3.0

**Before — Observatory 3.0 (separate draft PR #8)**

![Previous direction — Observatory 3.0](../observatory-3.0.0/discover-dark-desktop.png)

**After — Signal Field 3.1 (new experimental direction)**

![Signal Field Discover — dramatic editorial layout, live 17-sector map and index](discover-dark-desktop.png)

The change goes beyond colors: the primary entry is a typographic, print-inspired visual statement; the adjacent composition is *not* a decorative dashboard but a real sector filter, with counts derived from the loaded catalog. The index starts in the first desktop viewport, and the former redundant brand-shortcut area is no longer displayed.

## Same interface in a different light

![Signal Field Discover in light theme](discover-light-desktop.png)

## Actual working catalog, not a static render

![The editorial catalog with a featured first result](catalog-grid-dark-desktop.png)

The enlarged first result is a **visual feature**, not a quality rank or product recommendation. Every result retains its original real source, app status, safety restrictions, detail inspector and contextual action.

## One-click discovery

![Real sector filter applied (3D and manufacturing)](real-sector-filter-desktop.png)

Choosing the **3D & CAD** field actually filters the index to the 28 matching projects on this device. Selecting **Show all 17 categories** reveals every discipline with its real current count. No extra shortcut controls repeat these destinations.

## Workspaces use the same design language

**My toolkit — your installed software and verification operation**

![My toolkit after redesign](toolkit-dark-desktop.png)

**Activity — sole destination for running, waiting and historical operations**

![Activity after redesign](activity-dark-desktop.png)

## Phone-sized experience

![Discover at 430 pixels wide](discover-dark-mobile.png)

## Try the candidate without touching production

Open **http://127.0.0.1:17949/** from a browser running directly on Chris or MacMiniOffice.local (localhost resolves on each device independently). The preview server accepts **GET/HEAD only** and refuses all mutation requests. The baseline **3.0** preview remains at **http://127.0.0.1:17948/**. The untouched **production 2.7** remains at **http://127.0.0.1:17873/**.

**Decision gate:** Please review the *creative direction*, not minor padding or CSS polish. Is this distinct, memorable field-guide/art-book character right for Challenger Hub, or should the product identity move toward a different kind of premium software tool? No production rollout will occur without separate approval.
