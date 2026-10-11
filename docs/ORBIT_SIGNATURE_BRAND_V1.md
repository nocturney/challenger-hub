# Challenger Orbit Signature Brand Assets v1.0 — development handoff

**Status: staged in Windows and Mac Focus 4.0. Draft PR only, not merged or released.**

## Brand direction
Approved identity: Orbit Signature, muted graphite and sage; generated from approved raster board. This is a vector trace, not the original editable native design file. No blue-purple futuristic effects. No slogan was separately approved; the app title is plain challenger text.
Colors: Canvas #F8F7F3, Graphite #1F2A26, Sage #6B8F7A, Mist #DDE3DE, app green #184936. Signature, Flat, Dark and Mono variants.

## Git files
index.html: favicon SVG plus PNG fallback; light/dark header Orbit mark. style.css: small append-only responsive rules to show one variant per theme. brand-icon.png: replacement compatibility fallback. favicon.ico: supported browser ICO. brand/orbit: 7 SVG source variants, 10 PNG sizes (16-1024), Windows ICO, Mac ICNS, and asset/readme. app.js and backend, scanner and installer data unchanged.

## Staging and rollback
Windows stage: D:/Velvet/Installers/CraftSuite/Center/FocusCandidate-v4.0.0
Mac stage: /Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center/FocusCandidate-v4.0.0
Live read-only on each machine: http://127.0.0.1:17951/ .
Backups + SHA256: <stage>/_qa/orbit-brand-v1-backup/ .
QA receipts: <stage>/_qa/orbit-brand-v1-review/orbit-brand-v1-qa.json .
Both hosts: 1590,950,430,320 in both themes, assets loaded, no page overflow/JS errors/writes, 17 disciplines and 3D 28-results flow verified. Host-specific source check warnings retained.

## No production authorization
Production UI 2.7 remains unchanged. Focus 4.0 is read-only and lacks installer/update action parity; this brand PR must remain draft until the user reviews screenshots. The subsequent major milestone is functional parity of approved existing workflows, with separate authorization and rollback before any production deploy.
