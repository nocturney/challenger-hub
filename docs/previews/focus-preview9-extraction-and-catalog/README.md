# Challenger Focus Desktop — Windows Preview 9

**Native, single-EXE first-launch repair + October 23, 2026 catalog refresh.** Windows test branch; no Production merge or macOS changes.

## Fixed incident: Preview 8 does not open

Actual native failure log: `DirectoryNotFoundException` at `media\\craft\\` while first extracting the embedded ZIP payload. PowerShell `Compress-Archive` wrote backslash-delimited ZIP directory entries, with empty `ZipArchiveEntry.Name`. The previous extractor looked for entry names ending in `/` only, so it attempted to open a directory as a file. **Preview 9 checks `string.IsNullOrEmpty(entry.Name)`**, while preserving ZIP containment checks, 700MB size bound and SHA256-verification of all bundled files.

**Actual first-launch acceptance:** With the per-user Preview9 Runtime directory absent, launched the final EXE under the logged-in Windows user, non-elevated Session 1. It extracted successfully, started the bundled Node child, initialized WebView2, and logged `Desktop UI navigation: True`. Private runtime reported `4.0.0-desktop.preview.9`, 14 managed, 152 independent, empty installation queue, and 14 candidate sources. The one-time QA trigger was deleted immediately.

## Refresh: every existing source examined

Authenticated read-only GitHub API checks: **152/152**, zero failures, 23 October 2026.

| Official evidence | Count | Display policy |
| --- | ---: | --- |
| Archived | **1** (`FlowiseAI/Flowise`) | Hidden from normal browsing, visible in Research with warning |
| Last GitHub code push >12 months ago | **5** | Further source-maintenance review required; no automatic deletion |
| Last GitHub code push 6–12 months ago | **1** | Low activity, not assumed abandoned |
| Other source repositories | **145** | No source-age warning; still not proof of install readiness |

The five quiet repositories: `vgc/vgc`, `stargatedaw/stargate`, `Inochi2D/inochi-creator`, `olive-editor/olive`, `abemelic/freeshow`. Additional 6-month case: `xibyte/jsketcher`. Source activity is **not** a definitive product maintenance/support assessment.

[Real screenshot: archived upstream evidence in project dossier](preview9-archived-flowise-transparent.png).

**Follow-up identified, intentionally not silently rewritten:** Old `abemelic/freeshow` last pushed 2022, but [ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow) is active and has the matching `freeshow.app` homepage. Updating this source identity needs a focused, verified mapping change; no installation authorization should be inherited just from matching a name.

## 14 newly verified candidate sources

A separate **research-only candidate watchlist** is visible inside native Explore: **14 official GitHub repositories checked**, **12 with recognized GitHub SPDX licences**, and **8 with a published GitHub non-prerelease**. Each row links directly to its upstream repository, with category, description, last push, licence and release observation. **Every entry explicitly has `installable:false`**; the list never triggers installs.

Candidate sources: SolidCraft, FreeCAD, OpenSCAD, OrcaSlicer, Graphite, Kdenlive, DCC-MCP Core, Blender MCP, FreeCAD MCP, text-to-cad, Varve, FundaCAD, OpenCut, ComfyUI.

For VelvetOS, **DCC-MCP Core**, FreeCAD MCP, Blender MCP and text-to-cad are integration research candidates, **not desktop software installers** and not substitutes for existing working infrastructure without qualification.

[Real screenshot: new candidate panel](preview9-new-candidates-research-only.png).

## Testing and distribution

- **70/70** unit/regression tests including embedded ZIP directory classification, catalog health and safe source watchlist.
- **10/10** bundled-engine browser tests, plus viewport, official Craft/independent images, self-update checks, profile completeness and candidate QA. No unexpected external browser requests, JavaScript errors or unintended mutations.
- **Native EXE first-run with empty runtime directory passed** (the previously broken scenario).
- Bundle size **95,784,879 bytes**, SHA256 **`2257c0f2dc1590acf9b71570eccb60af71c47fb17b38cf59418dc73fb61e79cd`**, 150 individually SHA256-pinned runtime files.
- Runs as a normal-sized WinForms/WebView2 window, not forced maximized. No extra Node or .NET runtime needed; Windows WebView2 Evergreen required.
- **Unsigned test build**, possible SmartScreen. **No automatic self-replacement, no new installer privileges**, no macOS rollout and no Production change.

Source branch: `fix/focus-preview9-extraction-catalog-health`. GitHub prerelease target `v4.0.0-orbit-preview.9`. Do not use Preview 8 for a fresh Windows installation.
