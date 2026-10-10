$ErrorActionPreference='Stop'
$repo='wordcraft'
$root='D:\Velvet\Installers\CraftSuite'
$resolver=Join-Path $root 'Resolve-CraftRelease.js'
$node='C:\Program Files\nodejs\node.exe'
if(-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $resolver)) {throw 'Official release resolver unavailable'}
$tag=[string](& $node $resolver $repo)
if($LASTEXITCODE -ne 0 -or $tag -notmatch '^v?[0-9][a-zA-Z0-9._+-]{0,80}$') {throw 'Official WordCraft release could not be verified'}
$v=$tag -replace '^v',''
$name="$repo-$v-windows-x64-portable.zip"
$url="https://github.com/storytold/$repo/releases/download/$tag"
$checksumUrl="$url/SHA256SUMS.txt"
$assetUrl="$url/$name"
$sumfile=Join-Path $root "$repo-$v-SHA256SUMS.txt"
$zipfile=Join-Path $root $name
if(-not (Test-Path $sumfile)) {
  & curl.exe -fLsS --retry 3 -o $sumfile $checksumUrl
  if($LASTEXITCODE -ne 0) {throw 'Checksum download failed'}
}
$m=[regex]::Match((Get-Content $sumfile -Raw),'(?im)^([0-9a-f]{64})\s+\*?'+[regex]::Escape($name)+'\s*$')
if(-not $m.Success) {throw 'Missing ZIP SHA256'}
$expected=$m.Groups[1].Value.ToLowerInvariant()
$actual=if(Test-Path $zipfile) {(Get-FileHash $zipfile -Algorithm SHA256).Hash.ToLowerInvariant()} else {''}
if($expected -ne $actual) {
  & curl.exe --fail --location --silent --show-error --retry 3 --connect-timeout 30 --max-time 600 -o $zipfile $assetUrl
  if($LASTEXITCODE -ne 0) {throw 'Portable ZIP download failed'}
  $actual=(Get-FileHash $zipfile -Algorithm SHA256).Hash.ToLowerInvariant()
}
if($expected -ne $actual) {throw 'ZIP SHA256 does not match official release'}
$unpack=Join-Path $root "$repo-$v-portable-unpacked"
New-Item -ItemType Directory -Path $unpack -Force | Out-Null
Expand-Archive -LiteralPath $zipfile -DestinationPath $unpack -Force
$exe=Get-ChildItem -Path $unpack -Recurse -File -Filter 'wordcraft.exe' | Select-Object -First 1
if(-not $exe) {throw 'wordcraft.exe not found in official ZIP'}
$sig=Get-AuthenticodeSignature -LiteralPath $exe.FullName
if($sig.Status -ne 'Valid') {throw "Portable exe signature invalid: $($sig.Status)"}
$src=$exe.DirectoryName
$dest='C:\Program Files\WordCraft'
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $dest -Recurse -Force
$portableFlag=Join-Path $dest 'portable.txt'
if(Test-Path $portableFlag) {Remove-Item $portableFlag -Force}
$installed=Join-Path $dest 'wordcraft.exe'
$version=(Get-Item $installed).VersionInfo.ProductVersion
if($version -ne $v) {throw "Installed binary version mismatch: $version"}
$shortcut='C:\ProgramData\Microsoft\Windows\Start Menu\Programs\WordCraft.lnk'
$sh=New-Object -ComObject WScript.Shell
$link=$sh.CreateShortcut($shortcut)
$link.TargetPath=$installed
$link.WorkingDirectory=$dest
$link.Description='WordCraft - open source word processor'
$link.IconLocation="$installed,0"
$link.Save()
$result=[ordered]@{product='WordCraft';result='installed_portable';version=$version;path=$installed;sha256=$expected;signature=$sig.Status;shortcut=$shortcut;msiIssue='WordCraft MSI uses same UpgradeCode as DesignCraft'}
$result|ConvertTo-Json -Compress
