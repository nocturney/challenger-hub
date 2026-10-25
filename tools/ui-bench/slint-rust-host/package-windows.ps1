# Developer-only Windows package; never installs applications or changes Production.
param([switch]$DebugBuild)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$repo = (Resolve-Path (Join-Path $here '..\..\..')).Path
$runtime = Join-Path $repo 'tools\desktop-build\dist\runtime-preview12'
$seed = Join-Path $repo 'tools\desktop-build\seeds\catalog-candidates.preview10.json'
if (!(Test-Path (Join-Path $runtime 'desktop-manifest.json')) -or !(Test-Path $seed)) {
  throw 'Preview12 runtime or pinned research seed missing'
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$requiredNodeVersion = 'v24.22.1'
$nodeVersion = (& $node --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne $requiredNodeVersion) {
  throw "Refusing unpatched/unreviewed Node: expected $requiredNodeVersion, found $nodeVersion"
}
$nodeArch = (& $node -p 'process.arch' | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeArch -ne 'x64') { throw "Windows x64 package requires x64 Node, found $nodeArch" }
$nodeLicense = Join-Path $here 'legal/node-v24.22.1/LICENSE'
if (!(Test-Path -PathType Leaf $nodeLicense) -or (Get-Item $nodeLicense).Length -lt 150000) {
  throw 'Pinned Node third-party LICENSE missing or incomplete'
}
$buildArgs = @('build', '--manifest-path', (Join-Path $here 'Cargo.toml'), '--locked')
if (-not $DebugBuild) { $buildArgs += '--release' }
& cargo @buildArgs
if ($LASTEXITCODE -ne 0) { throw 'Rust build failed' }
$profile = if ($DebugBuild) { 'debug' } else { 'release' }
$target = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $here 'target' }
$out = Join-Path $here 'dist\ChallengerHubNativePreview-Win'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $out 'resources') | Out-Null
Copy-Item (Join-Path (Join-Path $target $profile) 'challenger-slint-rust-host.exe') $out
Copy-Item $node (Join-Path $out 'resources\node.exe')
Copy-Item $nodeLicense (Join-Path $out 'resources\NODE_LICENSE.txt')
# Keep exact source and license notices beside bundled, in-binary media.
$mediaNoticeDest = Join-Path $out 'resources\media-notices'
New-Item -ItemType Directory -Force -Path $mediaNoticeDest | Out-Null
Copy-Item (Join-Path $repo 'tools\preview-build\media-source\CRAFT_SUITE_MEDIA_NOTICES.md') $mediaNoticeDest
Copy-Item (Join-Path $repo 'tools\preview-build\media-source\THIRD_PARTY_MEDIA_NOTICES.md') $mediaNoticeDest
Copy-Item (Join-Path $repo 'tools\preview-build\media-source\licenses\*.txt') $mediaNoticeDest
Copy-Item (Join-Path $here 'ui\APPROVED_GALLERY_INDEX.json') $mediaNoticeDest
Copy-Item (Join-Path $here 'ui\INDEPENDENT_NATIVE_MEDIA_NOTICES.md') $mediaNoticeDest
Copy-Item (Join-Path $here 'ui\MEDIA_CREDITS.json') $mediaNoticeDest
Copy-Item (Join-Path $here 'ui\MEDIA_CREDITS.md') $mediaNoticeDest

Copy-Item (Join-Path $here '..\slint-node-bridge\sidecar.mjs') (Join-Path $out 'resources')
Copy-Item (Join-Path $here '..\slint-node-bridge\native-updates.mjs') (Join-Path $out 'resources')
Copy-Item (Join-Path $here '..\slint-node-bridge\live-catalog.mjs') (Join-Path $out 'resources')
Copy-Item (Join-Path $here '..\slint-node-bridge\install-bridge.mjs') (Join-Path $out 'resources')
Copy-Item $seed (Join-Path $out 'resources\catalog-candidates.preview10.json')
Copy-Item $runtime (Join-Path $out 'resources\runtime-preview12') -Recurse
$bundledNode = Join-Path $out 'resources/node.exe'
$bundledNotice = Join-Path $out 'resources/NODE_LICENSE.txt'
$bundledVersion = (& $bundledNode --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $bundledVersion -ne $requiredNodeVersion -or !(Test-Path -PathType Leaf $bundledNotice)) {
  throw 'Packaged Node runtime or required LICENSE is invalid'
}
$nodeBundleSha = (Get-FileHash -LiteralPath $bundledNode -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "WINDOWS_NATIVE_NODE_BUNDLE_PASS version=$requiredNodeVersion arch=x64 sha256=$nodeBundleSha license=NODE_LICENSE.txt"
Write-Host "WINDOWS_NATIVE_PACKAGE_CREATED $out"
Write-Host 'Developer preview only; no installer or Production replacement.'
