param([switch]$Child)
$ErrorActionPreference='Stop'
$buildRoot=Join-Path $PSScriptRoot 'dist'
$exe=Join-Path $buildRoot 'onefile-preview11\publish\ChallengerFocusDesktopPreview11.exe'
$qaDir=Join-Path $buildRoot 'qa-native-preview11'
$resultFile=Join-Path $qaDir 'first-run.json'
$taskName='VF-Challenger-Preview11-QA-Temp'
if($Child){
    $root=Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)) 'VelvetOS\ChallengerFocusDesktop\Preview11'
    $runtime=Join-Path $root 'runtime'
    $log=Join-Path $root 'startup.log'
    $proc=$null
    $result=[ordered]@{
        schema='challenger-preview11-native-first-run.v1'
        observedAt=[DateTime]::UtcNow.ToString('o')
        sessionId=[Diagnostics.Process]::GetCurrentProcess().SessionId
        user=[Environment]::UserName
        firstRun=!(Test-Path -LiteralPath $runtime)
        started=$false
        webViewReady=$false
        navigationSuccess=$false
        windowWidth=0
        windowHeight=0
        cleanClose=$false
        pass=$false
        error=$null
    }
    try {
        if(Test-Path -LiteralPath $resultFile){throw 'Result exists; refusing overwrite'}
        if($result.sessionId -ne 1){throw 'QA requires real user console session 1'}
        if($result.user -ne 'Chris'){throw 'Unexpected interactive user'}
        if(!$result.firstRun){throw 'Isolated Preview11 runtime already exists: not a clean first run'}
        if(!(Test-Path -LiteralPath $exe)){throw 'Preview11 EXE absent'}
        $proc=Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe) -PassThru
        $result.started=$true
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Preview11Window {
    [StructLayout(LayoutKind.Sequential)] public struct RECT {public int Left, Top, Right, Bottom;}
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
}
'@
        for($i=0;$i -lt 70;$i++){
            Start-Sleep -Milliseconds 500
            $proc.Refresh()
            if($proc.HasExited){throw ('EXE exited unexpectedly '+$proc.ExitCode)}
            if(Test-Path -LiteralPath $log){
                $logText=[IO.File]::ReadAllText($log)
                if($logText.Contains('Native WebView2 initialized')){$result.webViewReady=$true}
                if($logText.Contains('Desktop UI navigation: True')){$result.navigationSuccess=$true}
            }
            if($proc.MainWindowHandle -ne [IntPtr]::Zero){
                $r=New-Object Preview11Window+RECT
                if([Preview11Window]::GetWindowRect($proc.MainWindowHandle,[ref]$r)){
                    $result.windowWidth=$r.Right-$r.Left
                    $result.windowHeight=$r.Bottom-$r.Top
                }
            }
            if($result.webViewReady -and $result.navigationSuccess -and $result.windowWidth -ge 720 -and $result.windowHeight -ge 500){break}
        }
        $result.pass=$result.webViewReady -and $result.navigationSuccess -and ($result.windowWidth -ge 720) -and ($result.windowHeight -ge 500)
        if(!$result.pass){throw 'No confirmed healthy native navigation and window'}
    }catch{
        $result.error=[string]$_.Exception.Message
    }finally{
        if($null -ne $proc){
            try {
                $proc.Refresh()
                if(!$proc.HasExited){
                    $proc.CloseMainWindow()|Out-Null
                    if(!$proc.WaitForExit(9000)){$proc.Kill();$proc.WaitForExit(3000)|Out-Null}
                }
                $result.cleanClose=$proc.HasExited
            }catch{$result.cleanClose=$false}
        }
        $result.pass=$result.pass -and $result.cleanClose
        $result.observedAt=[DateTime]::UtcNow.ToString('o')
        $result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $resultFile -Encoding UTF8
        Write-Output ('PREVIEW11_NATIVE_CHILD '+($result|ConvertTo-Json -Compress))
    }
    if($result.pass){exit 0}else{exit 2}
}
if([Diagnostics.Process]::GetCurrentProcess().SessionId -ne 0){throw 'Controller requires service session 0'}
if(!(Test-Path -LiteralPath $exe)){throw 'Preview11 binary missing'}
if(Test-Path -LiteralPath $resultFile){throw 'QA has already been run; refusing overwrite'}
New-Item -ItemType Directory -Force -Path $qaDir|Out-Null
$service=New-Object -ComObject 'Schedule.Service'
$service.Connect()
$folder=$service.GetFolder('\')
if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){throw 'Temporary QA task name collision'}
$registered=$false
$removed=$false
$pass=$false
$observed=$null
try{
    $definition=$service.NewTask(0)
    $definition.RegistrationInfo.Description='One-shot private Preview11 native acceptance; deleted in finally'
    $definition.Principal.UserId='CHRIS\Chris'
    $definition.Principal.LogonType=3
    $definition.Principal.RunLevel=0
    $definition.Settings.Enabled=$true
    $definition.Settings.AllowDemandStart=$true
    $definition.Settings.Hidden=$true
    $definition.Settings.ExecutionTimeLimit='PT3M'
    $action=$definition.Actions.Create(0)
    $action.Path='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
    $action.Arguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -Child'
    $action.WorkingDirectory=$qaDir
    $task=$folder.RegisterTaskDefinition($taskName,$definition,6,$null,$null,3,$null)
    $registered=$true
    $task.Run($null)|Out-Null
    for($i=0;$i -lt 140;$i++){
        Start-Sleep -Milliseconds 500
        if(Test-Path -LiteralPath $resultFile){
            $observed=Get-Content -LiteralPath $resultFile -Raw|ConvertFrom-Json
            break
        }
    }
    if($null -eq $observed){throw ('Native test timed out, task result '+$task.LastTaskResult)}
    $pass=$observed.pass -and $observed.sessionId -eq 1 -and $observed.firstRun
    if(!$pass){throw ('Native acceptance failed: '+($observed|ConvertTo-Json -Compress))}
}catch{
    Write-Output ('PREVIEW11_NATIVE_ERROR '+[string]$_.Exception.Message)
}finally{
    if($registered){
        try{$folder.DeleteTask($taskName,0);$removed=$true}
        catch{Write-Output ('PREVIEW11_NATIVE_TASK_REMOVAL_ERROR '+[string]$_.Exception.Message)}
    }else{$removed=$true}
    if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){$removed=$false}
    Write-Output ('PREVIEW11_NATIVE_FIRST_RUN '+($observed|ConvertTo-Json -Compress))
    Write-Output ('PREVIEW11_TEMP_TASK_CLEANED '+$removed)
}
if($pass -and $removed){exit 0}else{exit 2}
