param([switch]$Child)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSCommandPath
$exe=Join-Path $root 'dist\win32-x64\Challenger Hub Cross Platform Pilot-win32-x64\ChallengerHubPilot12.exe'
$output=Join-Path $root 'dist\qa-win-electron-pilot12.json'
$profile=Join-Path $env:APPDATA 'VelvetOS\ChallengerFocusDesktop\CrossPlatformPilot12'
$smoke=Join-Path $profile 'smoke.json'
$taskName='VF-Challenger-Pilot12-Electron-Windows-QA-TEMP'
if($Child){
 $record=[ordered]@{schema='challenger-electron-windows-pilot12.v1';
   session=[Diagnostics.Process]::GetCurrentProcess().SessionId;user=$env:USERNAME;
   started=$false;exitCode=$null;smoke=$null;pass=$false;error=$null}
 try{
  if(Test-Path -LiteralPath $output){throw 'Old QA result exists'}
  if($record.session -ne 1 -or $record.user -ne 'Chris'){throw 'Not the expected interactive session 1'}
  if(!(Test-Path -LiteralPath $exe)){throw 'Packaged Windows Electron EXE missing'}
  if(Test-Path -LiteralPath $smoke){throw 'Previous smoke result exists; refusing stale validation'}
  $process=Start-Process -FilePath $exe -ArgumentList '--challenger-smoke','--challenger-offline' -WorkingDirectory (Split-Path $exe) -PassThru
  $record.started=$true
  if(!$process.WaitForExit(105000)){throw 'Native Electron pilot timed out'}
  $record.exitCode=$process.ExitCode
  if($record.exitCode -ne 0){throw ('Native Electron exited '+$record.exitCode)}
  if(!(Test-Path -LiteralPath $smoke)){throw 'Native Electron smoke result missing'}
  $native=Get-Content -Raw -LiteralPath $smoke|ConvertFrom-Json
  $record.smoke=$native
  $record.pass=($native.ok -eq $true -and $native.platform -eq 'win32' -and $native.entries -eq 181 -and $native.sandbox -eq $true)
  if(!$record.pass){throw 'Electron smoke facts failed validation'}
 }catch{$record.error=[string]$_.Exception.Message}
 finally{
  $record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $output -Encoding UTF8
  Write-Output ('CROSSPLATFORM_WINDOWS_QA '+($record|ConvertTo-Json -Compress -Depth 8))
 }
 if($record.pass){exit 0}else{exit 2}
}
if([Diagnostics.Process]::GetCurrentProcess().SessionId -ne 0){throw 'Controller expects isolated service session'}
if(!(Test-Path -LiteralPath $exe)){throw 'Packaged EXE missing'}
if(Test-Path -LiteralPath $output){throw 'QA result already exists'}
$service=New-Object -ComObject Schedule.Service
$service.Connect()
$folder=$service.GetFolder('\')
if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){throw 'Temporary task name already exists'}
$created=$false;$cleaned=$false;$passed=$false;$result=$null
try{
 $definition=$service.NewTask(0)
 $definition.RegistrationInfo.Description='Temporary session-1 Electron smoke; removed immediately'
 $definition.Principal.UserId='CHRIS\Chris'
 $definition.Principal.LogonType=3
 $definition.Principal.RunLevel=0
 $definition.Settings.Enabled=$true
 $definition.Settings.AllowDemandStart=$true
 $definition.Settings.Hidden=$true
 $definition.Settings.ExecutionTimeLimit='PT3M'
 $action=$definition.Actions.Create(0)
 $action.Path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 $action.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -Child'
 $action.WorkingDirectory=$root
 $task=$folder.RegisterTaskDefinition($taskName,$definition,6,$null,$null,3,$null)
 $created=$true
 $task.Run($null)|Out-Null
 for($i=0;$i -lt 230;$i++){
  Start-Sleep -Milliseconds 500
  if(Test-Path -LiteralPath $output){$result=Get-Content -Raw -LiteralPath $output|ConvertFrom-Json;break}
 }
 if($null -eq $result){throw ('Timed out, last task result '+$task.LastTaskResult)}
 $passed=$result.pass -eq $true
 if(!$passed){throw ('Native pilot failed '+($result|ConvertTo-Json -Compress -Depth 6))}
}catch{Write-Output ('CROSSPLATFORM_WINDOWS_QA_ERROR '+[string]$_.Exception.Message)}
finally{
 if($created){try{$folder.DeleteTask($taskName,0);$cleaned=$true}
  catch{Write-Output ('CROSSPLATFORM_WINDOWS_QA_CLEANUP_ERROR '+[string]$_.Exception.Message)}}
 else{$cleaned=$true}
 if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){$cleaned=$false}
 Write-Output ('CROSSPLATFORM_WINDOWS_QA_RESULT '+($result|ConvertTo-Json -Compress -Depth 8))
 Write-Output ('CROSSPLATFORM_WINDOWS_QA_TASK_REMOVED '+$cleaned)
}
if($passed -and $cleaned){exit 0}else{exit 2}
