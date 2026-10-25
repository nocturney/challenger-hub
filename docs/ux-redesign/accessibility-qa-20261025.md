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
  This strongly suggests first-run OS/extraction overhead, but does not
  conclusively attribute the cause. The Windows outer guard is extended to
  **40 seconds**, still bounded, with existing process-tree kill and 12-second
  in-engine health deadline unchanged. Verify the change on a new cold
  Windows package before declaring resolved.
- Desktop Commander terminal executes under Windows **Session 0**. An
  ephemeral, explicitly named Task Scheduler QA action under the already
  logged-in Chris user, with `InteractiveToken` (Session 1), exposed the
  actual UI Automation tree. The task was subsequently deleted. It neither
  installed software nor wrote to application preferences.
- **UI Automation (old PR #33 artifact):** 90 elements were found, including
  focusable search, navigation, preference sections, System/Reduce/Allow,
  On/Off and Close. On this older artifact the choices were still buttons;
  the revised draft makes them real, checkable/checked radio buttons.
  **Re-run UIA on the updated artifact**; do not retroactively report that
  the new semantics passed.
- **Real Windows input:** Ctrl+, opened Preferences, and Escape dismissed it.
  Both were confirmed by the UI Automation tree with the window foregrounded.

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

1. Windows UIA rerun on the newly compiled radio/text-scale artifact (should
   expose radio roles, checked values and focusability), Windows native
   UI smoke/resize and the extended cold-start case.
2. Mac and Windows resized/native visual QA at 100/125/150, including
   ensuring no hidden settings control or clipped labels.
3. Actual Narrator / NVDA and VoiceOver spoken output, live keyboard traversal,
   200%-zoom/RTL/IME acceptance with a real interactive accessibility session.
   UI Automation properties alone **cannot prove** that spoken presentation is
   understandable.
4. Media rights, signing and public release approval are independently blocked.

All tests are developer-preview read-only actions except the deliberately
isolated, user-triggered preference storage QA. No merge, launch, installs
or changes to user device settings are authorized by this report.
