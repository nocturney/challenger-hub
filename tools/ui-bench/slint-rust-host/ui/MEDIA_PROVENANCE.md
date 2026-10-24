# Native Focus media — exact source-verified assets

Assets were copied from the existing approved `tools/preview-build/media-source/project-media.v1.json` and its immutable local assets, **not** retrieved opportunistically or generated. Show them only for the matching source identity. Lack of verified image gets a neutral fallback.

| Native asset | Project / upstream source | SHA-256 | Reported license |
| --- | --- | --- | --- |
| orbit-app-128.png | Velvet Factory/Challenger Orbit brand export | a22b1ff013ed293120921ce77c6e15fc51982adb103c7d7ecdde240a6b597358 | project-owned |
| dune3d.svg | https://github.com/dune3d/dune3d/blob/main/src/icons/scalable/apps/dune3d.svg | c6824333ee080b348032dd25b19af65766e62ea1db7128415b0f6f21b4fbaefe | GPL-3.0 |
| dune3d.png | https://github.com/dune3d/dune3d/blob/d01faaf16f309e55834c3b93dddce5c852453cfe/screenshot.png | 56f79318ff609044b6e6f3173c77cbb541a09475353f854b667cf99d7bf1c595 | GPL-3.0 |
| material-maker-icon.png | https://github.com/RodZill4/material-maker/blob/master/icon.png | 72ee1a0fc59b798b8849eb9bd0cb7b67fd9ee3ff41645f90c2ca98168f3619ef | MIT |
| material-maker.png | https://github.com/RodZill4/material-maker/blob/424dec64a75478f22267ba9281a5cbe7a236b802/material_maker/doc/images/screenshot.png | 82914343db0a3af22f5b96f7b42e362f58f93f9c499b3fad48d182d9059e4f7c | MIT |

These assets already appeared in the audited Focus preview media manifest (with source commits, license links and image checksums). For third-party redistribution, retain the full accompanying source/license notices in `tools/preview-build/media-source/licenses/` and review Slint's own license obligations before publishing a release. This is a local developer preview only, not public distribution.
