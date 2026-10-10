$ErrorActionPreference='Stop'
$root='D:\Velvet\Installers\CraftSuite\Center'
$server=Join-Path $root 'server.js'
$node='C:\Program Files\nodejs\node.exe'
function Test-Center {
  try { $x=Invoke-RestMethod -Uri 'http://127.0.0.1:17873/api/health' -TimeoutSec 2; return ($x.app -eq 'Craft Update Center') } catch { return $false }
}
if(Test-Center){exit 0}
$isAdmin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if(-not $isAdmin){
  $arg='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$PSCommandPath+'"'
  try{
    $p=Start-Process -FilePath 'powershell.exe' -ArgumentList $arg -Verb RunAs -Wait -PassThru -WindowStyle Hidden
    exit ([int]$p.ExitCode)
  }catch{exit 5}
}
if(-not (Test-Path $server) -or -not (Test-Path $node)){exit 6}
try{$p=Start-Process -FilePath $node -ArgumentList ('"'+$server+'"') -WorkingDirectory $root -WindowStyle Hidden -PassThru}catch{exit 7}
for($n=0;$n -lt 30;$n++){Start-Sleep -Milliseconds 350;if(Test-Center){exit 0};if($p.HasExited){break}}
exit 8
