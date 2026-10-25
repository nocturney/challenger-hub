# Challenger native Accessibility QA — 25 October 2026

Stacked on Draft PR #33, not merged or released.

## Reproducible checks and facts

### Windows on the actual Chris workstation

- GitHub Actions PR #33 (commit 868b225, run 40183163030) succeeded on Linux/macOS.
  Windows native Slint build, smoke and 820/1180 resize checks passed.
- Downloaded the **Windows portable developer artifact**, not an installer, to
  `%LOCALAPPDATA%\Temp\ChallengerNativeQA-PR33`; verified the inner ZIP SHA256
  `f255c058835c76680e2513a55866f60c75cf174bc02eb8f2ada5cc0ad480bb5e`
  against the bundled SHA256SUMS manifest.
- **First, cold launch** from the freshly expanded ZIP refused startup when
  the 22-second outer sidecar guard expired. This is an actual workstation
  failure; do not ignore it because CI passed.
- Direct bundled sidecar read on the warmed cache returned 181 records in
  **4,530 ms**; an immediate subsequent native GUI smoke passed in **5,264 ms**.
  The revised Windows outer guard is **40 seconds**, while the inner health
  deadline and process-tree cleanup remain bounded. On the new GitHub-built
  portable ZIP for commit `a1f0985`, the first extracted launch produced
  `FOCUS_NATIVE_GUI_PASS` with `startToReadyMs=5289`: no cold timeout
  recurred. Its PowerShell wrapper erroneously treated that PASS message on
  stderr as terminating, so the wrapper exited 1; a separate native launch
  using `Start-Process` exited **0** with `startToReadyMs=5186`.
  This is successful functional acceptance, not an OS cold-start benchmark.
- Desktop Commander terminal executes under Windows **Session 0**. An
  ephemeral, explicitly named Task Scheduler QA action under the already
  logged-in Chris user, with `InteractiveToken` (Session 1), exposed the
  actual UI Automation tree. The task was subsequently deleted. It neither
  installed software nor wrote to application preferences.
- **UI Automation (previous artifact):** 90 elements exposed and keyboard
  focus confirmed for search, navigation and preferences; choices were Buttons.
- **UI Automation (new artifact):** the verified ZIP SHA-256
  `2f8d4889dae80b1ec92aef3606264c2418bd85a3b7cafe255f35137c8b5d98a4`
  belonged to PR head `a1f0985`. In Session 1, the fixed readiness-aware
  harness returned **98 UIA elements, 12 native RadioButtons** and
  `verified=true`, including three text-scale radio options.
  Earlier false-negative reports were due to sampling before the popup
  existed, not to missing roles. UIA returned `IsKeyboardFocusable=false`
  for individual radio nodes; actual Tab key events nevertheless focused
  them in order. Screen-reader behavior still needs spoken-output validation.
- **Real Windows input:** Ctrl+, opened Preferences, Escape dismissed it,
  and Tab traversed the home controls and modal RadioButtons without leaving
  the popup. The new artifact's actual 150% text-size selection persisted
  `text_scale=150`; Reset preferences restored 100% in isolated APPDATA.
  Dark -> Light -> System and reset were likewise confirmed on the prior
  binary. No real user preferences were changed; temporary QA tasks removed.
- **CI:** https://github.com/nocturney/challenger-hub/actions/runs/40185574642
  completed successfully on Windows, macOS and Ubuntu.

The reproducible interactive QA harness is
`tools/ui-bench/slint-rust-host/qa/windows-accessibility.ps1`.
Run it on an **interactive, logged-in Windows desktop** with
`-Executable <portable path> -Mode tree` or `-Mode shortcut`.
No admin rights should be required for the harness itself. It deliberately
refuses Session 0 rather than fabricating a screen-reader pass.

### Mac native checks

The Slint GUI and Preferences were already captured in real Mac windows.
`AXIsProcessTrusted()` returned **false** for the current remote terminal,
so there is no permission to inspect the cross-process macOS accessibility tree
or inject macOS Command+, from this automation context. We have not bypassed
macOS permission controls and have not claimed to have tested VoiceOver speech.

### Native text enlargement (new)

A versioned optional `text_scale` preference defaults to **100%** when older
schema-v1 preference JSON is loaded, and rejects unsupported values.
Options: **100%, 125%, 150%**; both app-authored text and generated
source-credit captions use a single global font scale. The system/contrast/
motion settings remain independent, and changes persist with the existing
bounded atomic-write preferences path.

Real native Mac captures confirm 150 percent text in Accessibility and
820px Browse. The first 820px image exposed overlapping header labels;
the revised compact layout abbreviates only visible navigation labels at
125/150 percent, retaining full accessibility names. All three native
LineEdit fields and the window default font now scale. The latest 820px
screenshot shows separated Home / Find / Apps / Log / Prefs / Sync controls.

A Rust regression scans **all** native `font-size` rules in the application,
product/identity cards and source-authentic gallery and refuses any without
the scale binding. It also asserts actual Slint radio-button semantics.
Source media images and icons are not scaled/modified by this transformation.
App-wide 200% zoom, IME composition, VoiceOver and Narrator/NVDA live
speech remain separate release acceptance criteria.

## Remaining pre-merge evidence

1. Actual **Narrator/NVDA and VoiceOver spoken-output** checks, including
   announcement of each radio choice's selection state. UIA metadata
   and Tab order alone cannot prove understandable screen-reader speech;
   macOS accessibility permission is not available to the current tool.
2. **200% text enlargement**, thorough RTL/IME input composition, live
   OS-theme updates, and complete DPI/window-size visual QA.
3. Investigation of Slint radio nodes reporting
   `IsKeyboardFocusable=false` despite successful physical Tab focus.
4. Media redistribution rights, publisher signing and user release approval
   remain separately blocked.

All tests are developer-preview read-only actions except the deliberately
isolated, user-triggered preference storage QA. No merge, launch, installs
or changes to user device settings are authorized by this report.
