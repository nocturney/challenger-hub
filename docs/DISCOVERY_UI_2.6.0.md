# Challenger Hub 2.6.0 — Contextual Discovery + Daily Pick

**Scope:** front-end UI only, 2026-10-10. Deployment status should be read from the current handoff after live verification.

## User feedback addressed
- Competing-software chips were clipped in Grid cards, particularly for narrow cards and long names.
- Fallback text "Vendor to verify" was presented as if it were a real maker.
- The "Company → Product" layout felt redundant and unnecessarily technical.
- General visual treatment remained too similar to the earlier software catalog.
- Top hero and featured comparison shortcuts stayed almost static instead of adapting to the current task.
- Requested an automatically rotating daily recommendation.

## Changes
1. **Readable competitors:** remove forced chip maximum heights, text ellipses and overflow clipping in Grid and List. Flow long names into new lines. No unknown-vendor placeholders. If a maker is known, render the maker and product together without arrows; if not, render only the product. Prevent repeating a maker that already appears in the product name. Omit the comparison row entirely if no competing product is specified. In Details, omit empty "Competing companies" entries rather than displaying "Vendor to verify".
2. **Contextual hero:** the large banner responds live to a selected project, global search, Updates, Installed, Discoveries, focused category/subcategory and home context. Heading, subtitle, semantic action and accent treatment change. Buttons navigate to existing project details, results or the current Updates panel; no automatic installation, queue mutation or new API endpoint.
3. **Daily Discovery:** a distinct editorial card surfaces one catalogued independent project. Its selection is deterministic by the local calendar day, stable within that day and rotates the next day. Earlier repository-linked projects are favored over recent unverified research-only imports. The card shows project name, reported category, summary and clearly qualified maturity; the "Why this pick?" control explains the exploratory selection logic without claiming independent validation or recommending installation.
4. **Rotating comparison shortcuts:** preserve the four existing bound search controls but update their labels/queries from competitors actually present in the catalog, factoring in category, active search and selected project. Diversify publishers when possible and rotate choices by the local day. Suppress links that have no catalog matches instead of inventing results.
5. **Distinct visual system:** split the top area into a large context-specific hero and a dark daily editorial card with geometric orbit artwork. Improve visual hierarchy with transparent metric tiles, rich layered lighting, soft-card shadows, better spacing and calmer emphasis. Desktop side-by-side layout, responsive stacked composition for narrower screens, light/dark support and reduced-motion handling.
6. **Accessible loading state:** the daily slot is occupied by a busy/loading placeholder until catalog data arrives, avoiding an empty-column layout jump or clickable nonfunctional recommendation.
7. **Copy cleanup:** the cached-data warning no longer repeats "cached information remains available".

## Safety and source-of-truth
- Exactly three files are eligible for production promotion: app.js, index.html and style.css.
- server.js, source-scanner.js, challenger-core.js, Install-Challenger.js, adapters.json, portable-assets.json, sources.json and challengers.json are unchanged.
- The 164-entry catalog remains intact, including 73 research-only unverified candidates. No new installation approval, source verification, rating or usage claims have been added.
- Daily picks and suggestions are discovery prompts, not paid placements, quality endorsements or background installation decisions.
- No new network API requests were added by the feature.

## Verification
- Full headless Chrome/Edge browser QA on Windows and macOS for Grid/List at 1760, 1590, 1300, 1150, 950, 650, 430 and 320px.
- Verified no competitor clipping or document-level overflow, no vendor placeholders, no arrows, and correct full Mathesar comparison text.
- Verified context hero for search, selected project, Updates, Installed, Discoveries and Data & Apps; dynamic comparison button searches and "Why this pick?" dialog disclosure.
- Verified same-day daily selection stability, next-day change, and normal inspector opening/closing.
- No JS errors or mutating API requests in browser QA. Node unit tests added under tests/discovery-ui.test.js.
- Release screenshots and local QA receipts in each host's Center/UIDiscoveryCandidate-v2.6.0/_qa.

## Platform parity boundary
Windows and macOS production UI 2.5.9 had identical core app logic but platform-specific CSS and differing scanner implementations. The new three-file UI release is independently patched and verified for each platform, preserving the Mac-specific styling additions. The reviewed GitHub CSS source follows the Windows styling baseline; do not deploy it wholesale over Mac without a separate platform diff/QA.

## Rollback / continuation
Per-host backup manifests, SHA-256 verification and live production smoke tests are required prior to declaring the UI upgrade complete. The operational handoff in Google Drive carries final deployment/merge details and rollback paths.
