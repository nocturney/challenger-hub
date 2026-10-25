# Challenger Hub — native Preferences (stacked on PR #32)

25 October 2026. Developer Preview, Draft-only. Do not merge, auto-install or publish.

## Goal

Replace scattered toolbar Light/Dark and About actions with a genuine native
Slint preferences popup. Keep the existing read-only catalog, vetted installer
consent and source attribution intact. Avoid duplicate backends or paid APIs.

## Sections and real behavior

- **Appearance:** System, Light and Dark. System appearance is read on app
  startup and when selected: macOS AppleInterfaceStyle, Windows AppsUseLightTheme,
  GNOME color-scheme. A missing/unknown OS setting falls back to Light.
- **Accessibility:** System/Reduce/Allow motion, plus an explicit high-contrast
  preference. Reduced Motion from the host already supports OS preferences;
  choosing a local value overrides it. Slint native widgets use the matching
  Palette color scheme (including dark-mode CheckBox labels). Custom UI tokens
  use high-contrast colors. All preference choice buttons use the existing
  keyboard-focus / screen-reader accessible action component.
- **About & Updates:** current native development version, the unmodified
  official `AboutSlint` attribution component, media/license explanation, a
  manual read-only official release check and an external official Releases
  link. The old Preview12 Windows release must never be offered as a native
  update. No download or installation.
- **Privacy & Data:** summary of local-only preferences, explicit OS inventory
  read policy and reset to defaults.

The previous About route remains internally available to preserve existing
navigation regressions and attribution fallbacks, but the toolbar now exposes
Preferences instead.

## Persistent state

Versioned JSON schema v1, no tokens or personal records:

```json
{"schema":1,"appearance":"system","motion":"system","high_contrast":false}
```

Paths: macOS `~/Library/Application Support/Challenger Hub/preferences.json`,
Windows `%APPDATA%/Challenger Hub/preferences.json`, Linux
`$XDG_CONFIG_HOME/challenger-hub/preferences.json` or `~/.config/challenger-hub/`.
Write is explicit only when the user makes a preference change; bounded read,
validation, staging file, sync and rename. On corrupt/unsupported data, default
values appear with an error; the file is not silently overwritten.

## Manual update check boundaries

The native updater is a bundled one-shot Node script, invoked via the existing
bounded sidecar process supervisor only after user action (no server, schedule,
background refresh, secrets or paid services). It fetches a bounded listing
of official GitHub releases over HTTPS, requires an exact native release tag,
platform-specific asset identity and official SHA-256 digest. If the channel
does not yet exist, display **no verified native release published** rather
than claiming up to date. Link only to official GitHub releases; no in-app
installation or new release packaging.

## Actual native Mac UI evidence

The following are unmodified, **window-targeted macOS screencaptures** of
the modified Rust/Slint binary on MacMiniOffice2. They are not mockups.

- [Appearance (System / Light / Dark)](qa-native-preferences/01-appearance.png)
- [Accessibility (motion / high contrast)](qa-native-preferences/02-accessibility.png)
- [About & Updates, including official Slint attribution](qa-native-preferences/03-about-updates.png)
- [Preferences in Dark mode](qa-native-preferences/04-dark.png)

Verified local developer checks: native Rust build and 38 unit tests,
20 Node release/bridge/security checks, read-only catalog/media gates,
and a **sandbox-only QA route** that exercises the actual UI preference
callbacks, persisted JSON and reset-to-defaults without touching the real
user's settings. The native Preferences popup is keyboard-accessible; the
\`Control+Comma\` Slint accelerator maps to macOS Command+, and Windows
Ctrl+, through Slint's native menu shortcut API. These claims do not replace
platform-specific screen-reader testing.

## QA and release gates

Run native cargo tests and GUI smoke, real window review at compact/regular
width in both appearances, popup open/dismiss, keyboard navigation and
reduced-motion/high-contrast visual QA; Node release fixtures and integration
checks. Still necessary before production: app-wide text scaling, VoiceOver /
Narrator / NVDA walkthrough, RTL/IME coverage, OS theme switching during
runtime (currently read on launch/selection), Windows interactive smoke,
rights clearance and publisher signing. These must not be presented as done
merely because the Preferences UI exists.
