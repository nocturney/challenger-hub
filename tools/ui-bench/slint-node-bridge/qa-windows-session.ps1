param([switch]$Child)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSCommandPath
$qa=Join-Path $root 'qa-results'
$out=Join-Path $qa 'windows-native-slint.json'
$taskName='VF-Challenger-Slint-Node-QA-TEMP'
if($Child){
 $record=[ordered]@{schema='challenger-slint-live-win-qa.v1';session=[Diagnostics.Process]::GetCurrentProcess().SessionId;user=$env:USERNAME;windowObserved=$false;exitCode=$null;liveRecords=0;pass=$false;error=$null}
 try{
  if($record.session -ne 1 -or $record.user -ne 'Chris'){throw 'Not the expected interactive session 1'}
  if(Test-Path -LiteralPath $out){throw 'Existing QA result'}
  New-Item -ItemType Directory -Path $qa -Force | Out-Null
  $stdout=Join-Path $qa 'stdout.txt';$stderr=Join-Path $qa 'stderr.txt'
  if(Test-Path $stdout){throw 'Existing QA stdout'}
  $node=(Get-Command node.exe -ErrorAction Stop).Source
  $p=Start-Process -FilePath $node -WorkingDirectory $root -ArgumentList @('bridge.mjs','--smoke') -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  for($i=0;$i -lt 150;$i++){
   if($p.HasExited){break}
   $proc=Get-Process -Id $p.Id -ErrorAction SilentlyContinue
   if($proc -and $proc.MainWindowHandle -ne 0){$record.windowObserved=$true}
   Start-Sleep -Milliseconds 100
  }
  if(!$p.WaitForExit(25000)){throw 'Native GUI timed out'}
  $record.exitCode=$p.ExitCode
  $log=if(Test-Path $stdout){Get-Content -Raw -LiteralPath $stdout}else{''}
  $err=if(Test-Path $stderr){Get-Content -Raw -LiteralPath $stderr}else{''}
  $m=[regex]::Match($log,'SLINT_NODE_LIVE_GUI_PASS (\{[^\r\n]*\})')
  if(!$m.Success){throw ('Slint smoke marker missing: '+$err.Substring(0,[Math]::Min($err.Length,600)))}
  $facts=$m.Groups[1].Value|ConvertFrom-Json
  $record.liveRecords=$facts.visible
  # Start-Process with redirected streams does not expose ExitCode reliably in PowerShell 5.1.
  # Require the actual native window, terminated child, explicit application PASS marker and no stderr instead.
  $record.pass=($p.HasExited -and [string]::IsNullOrEmpty($err) -and $record.windowObserved -and $facts.visible -eq 181 -and $facts.platform -eq 'win32' -and $facts.counts.managed -eq 14 -and $facts.counts.curated -eq 152 -and $facts.counts.research -eq 15 -and $facts.nativeRenderer -eq $true -and $facts.networkScanDisabled -eq $true -and $facts.writeActionsExposed -eq $false)
  if(!$record.pass){throw ('Slint GUI facts invalid '+($facts|ConvertTo-Json -Compress))}
 }catch{$record.error=[string]$_.Exception.Message}
 finally{
  New-Item -ItemType Directory -Path $qa -Force | Out-Null
  $record|ConvertTo-Json -Depth 7|Set-Content -LiteralPath $out -Encoding UTF8
  Write-Output ('SLINT_WINDOWS_GUI '+($record|ConvertTo-Json -Compress -Depth 7))
 }
 if($record.pass){exit 0}else{exit 2}
}
if([Diagnostics.Process]::GetCurrentProcess().SessionId -ne 0){throw 'Expected service controller'}
if(Test-Path $out){throw 'Existing QA result'}
$service=New-Object -ComObject Schedule.Service
$service.Connect()
$folder=$service.GetFolder('\')
if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){throw 'Temporary task already exists'}
$created=$false;$cleaned=$false;$pass=$false;$result=$null
try{
 $definition=$service.NewTask(0)
 $definition.RegistrationInfo.Description='One-time Challenger Slint session-1 smoke; removed immediately'
 $definition.Principal.UserId='CHRIS\Chris'
 $definition.Principal.LogonType=3
 $definition.Principal.RunLevel=0
 $definition.Settings.Enabled=$true
 $definition.Settings.AllowDemandStart=$true
 $definition.Settings.Hidden=$true
 $definition.Settings.ExecutionTimeLimit='PT2M'
 $action=$definition.Actions.Create(0)
 $action.Path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 $action.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -Child'
 $action.WorkingDirectory=$root
 $task=$folder.RegisterTaskDefinition($taskName,$definition,6,$null,$null,3,$null)
 $created=$true
 $task.Run($null)|Out-Null
 for($i=0;$i -lt 160;$i++){
  Start-Sleep -Milliseconds 500
  if(Test-Path $out){$result=Get-Content -Raw $out|ConvertFrom-Json;break}
 }
 if(!$result){throw 'QA result timed out'}
 $pass=$result.pass -eq $true
 if(!$pass){throw ('GUI QA failed '+($result|ConvertTo-Json -Compress -Depth 7))}
}catch{Write-Output ('SLINT_WINDOWS_GUI_ERROR '+[string]$_.Exception.Message)}
finally{
 if($created){try{$folder.DeleteTask($taskName,0);$cleaned=$true}catch{Write-Output ('SLINT_QA_CLEANUP_ERROR '+$_.Exception.Message)}}
 else{$cleaned=$true}
 if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){$cleaned=$false}
 Write-Output ('SLINT_WINDOWS_GUI_RESULT '+($result|ConvertTo-Json -Compress -Depth 7))
 Write-Output ('SLINT_WINDOWS_TEMP_TASK_REMOVED '+$cleaned)
}
if($pass -and $cleaned){exit 0}else{exit 2}
