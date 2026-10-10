$ErrorActionPreference = 'Stop'
$names = @('photocraft','vectorcraft','lightcraft','filmcraft','effectcraft','designcraft','pdfcraft','wordcraft','gridcraft','deckcraft','cadcraft','soundcraft')
if ($env:CRAFT_ONE) { $names = @($env:CRAFT_ONE) }
$root = 'D:\Velvet\Installers\CraftSuite'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$log = Join-Path $root 'install-progress.jsonl'
function Status($repo,$version,$state,$detail) {
  $line = [ordered]@{date=(Get-Date).ToString('o');repo=$repo;version=$version;state=$state;detail=$detail} | ConvertTo-Json -Compress
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
  Write-Output $line
}
foreach ($repo in $names) {
  $v = '?'
  try {
    # GitHub REST API can return HTTP 403 when its anonymous quota is exhausted.
    # Resolve official /releases/latest via GitHub's validated web redirect.
    $resolver = Join-Path $root 'Resolve-CraftRelease.js'
    $node = 'C:\Program Files\nodejs\node.exe'
    if (-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $resolver)) { throw 'Official release resolver is unavailable' }
    $tag = [string](& $node $resolver $repo)
    if ($LASTEXITCODE -ne 0 -or $tag -notmatch '^v?[0-9][a-zA-Z0-9._+-]{0,80}$') { throw 'Official release tag could not be verified' }
    $v = $tag -replace '^v',''
    $filename = "$repo-$v-windows-x64.msi"
    $baseUrl = "https://github.com/storytold/$repo/releases/download/$tag"
    $sumUrl = "$baseUrl/SHA256SUMS.txt"
    $assetUrl = "$baseUrl/$filename"
    $folder = $repo.Substring(0,1).ToUpper() + $repo.Substring(1)
    if ($repo -eq 'cadcraft') { $folder='CADCraft' }
    if ($repo -eq 'pdfcraft') { $folder='PdfCraft' }
    $exe = Join-Path (Join-Path $env:ProgramFiles $folder) "$repo.exe"
    $installed = if (Test-Path -LiteralPath $exe) { [string](Get-Item -LiteralPath $exe).VersionInfo.ProductVersion } else { '' }
    if ($installed -eq $v) { Status $repo $v 'already_current' $exe; continue }
    if ($repo -eq 'wordcraft') {
      Status $repo $v 'installing_portable' 'Official MSI collides with DesignCraft; using signed portable ZIP'
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Install-WordCraft-Portable.ps1')
      if ($LASTEXITCODE -ne 0) { throw "Portable WordCraft installer exited $LASTEXITCODE" }
      $got = if (Test-Path $exe) { [string](Get-Item $exe).VersionInfo.ProductVersion } else { '' }
      if ($got -ne $v) { throw "Portable WordCraft version is $got, expected $v" }
      Status $repo $v 'installed_portable' $exe
      continue
    }
    Status $repo $v 'downloading' "installed=$installed"
    $sumfile = Join-Path $root "$repo-$v-SHA256SUMS.txt"
    $msifile = Join-Path $root $filename
    if (-not (Test-Path -LiteralPath $sumfile)) {
      & curl.exe --fail --location --silent --show-error --retry 3 --connect-timeout 30 --max-time 180 -o $sumfile $sumUrl
      if ($LASTEXITCODE -ne 0) { throw "Checksums download failed with code $LASTEXITCODE" }
    }
    $manifest = Get-Content -LiteralPath $sumfile -Raw
    $pattern = '(?im)^([0-9a-f]{64})\s+\*?' + [regex]::Escape($filename) + '\s*$'
    $m = [regex]::Match($manifest,$pattern)
    if (-not $m.Success) { throw "No SHA256 for $filename" }
    $expected = $m.Groups[1].Value.ToLowerInvariant()
    $have = if(Test-Path -LiteralPath $msifile) { (Get-FileHash -LiteralPath $msifile -Algorithm SHA256).Hash.ToLowerInvariant() } else {''}
    if ($have -ne $expected) {
      & curl.exe --fail --location --silent --show-error --retry 3 --connect-timeout 30 --max-time 900 -o $msifile $assetUrl
      if ($LASTEXITCODE -ne 0) { throw "MSI download failed with code $LASTEXITCODE" }
      $have = (Get-FileHash -LiteralPath $msifile -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    if ($have -ne $expected) { throw "MSI SHA256 mismatch" }
    $sig = Get-AuthenticodeSignature -LiteralPath $msifile
    Status $repo $v 'verified' "sha256=$expected signature=$($sig.Status)"
    if ($sig.Status -ne 'Valid') { throw "MSI Authenticode signature not valid: $($sig.Status)" }
    $msilog = Join-Path $root "$repo-$v-msi.log"
    $arg = "/i `"$msifile`" /qn /norestart REBOOT=ReallySuppress /l*v `"$msilog`""
    $proc= Start-Process -FilePath 'msiexec.exe' -ArgumentList $arg -PassThru -Wait -WindowStyle Hidden
    $code = [int]$proc.ExitCode
    $fileVersion = if (Test-Path -LiteralPath $exe) { [string](Get-Item -LiteralPath $exe).VersionInfo.ProductVersion } else {'missing exe'}
    if ($code -eq 0 -or $code -eq 3010) { Status $repo $v 'installed' "exit=$code;binary=$exe;binaryVersion=$fileVersion" }
    else { Status $repo $v 'install_failed' "exit=$code;msiLog=$msilog;binaryVersion=$fileVersion" }
  } catch {
    Status $repo $v 'error' $_.Exception.Message
  }
}
