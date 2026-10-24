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
Copy-Item (Join-Path $here '..\slint-node-bridge\sidecar.mjs') (Join-Path $out 'resources')
Copy-Item (Join-Path $here '..\slint-node-bridge\live-catalog.mjs') (Join-Path $out 'resources')
Copy-Item $seed (Join-Path $out 'resources\catalog-candidates.preview10.json')
Copy-Item $runtime (Join-Path $out 'resources\runtime-preview12') -Recurse
Write-Host "WINDOWS_NATIVE_PACKAGE_CREATED $out"
Write-Host 'Developer preview only; no installer or Production replacement.'
