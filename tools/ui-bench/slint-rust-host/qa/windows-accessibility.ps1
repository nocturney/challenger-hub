# Run on a logged-in interactive Windows desktop, not Session 0.
# Read-only QA for the portable native preview; no installation or writes to user settings.
param([Parameter(Mandatory=$true)][string]$Executable,
      [ValidateSet('tree','shortcut')][string]$Mode='tree',
      [string]$ReportPath='')
$ErrorActionPreference='Stop'
if((Get-Process -Id $PID).SessionId -eq 0){throw 'Interactive Windows session required'}
if(!(Test-Path -LiteralPath $Executable -PathType Leaf)){throw 'Native executable missing'}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class QaWindowFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);
}
'@
$env:SLINT_BACKEND='winit-software'
$env:CHALLENGER_REDUCED_MOTION='1'
$flag=if($Mode -eq 'tree'){'--qa-preview-preferences-accessibility'}else{'--qa-preview-home'}
$app=Start-Process -FilePath $Executable -ArgumentList $flag -PassThru
try {
  $root=[System.Windows.Automation.AutomationElement]::RootElement
  $window=$null
  for($i=0;$i -lt 40 -and $null -eq $window;$i++){
    Start-Sleep -Milliseconds 500
    $tops=$root.FindAll([System.Windows.Automation.TreeScope]::Children,
      [System.Windows.Automation.Condition]::TrueCondition)
    foreach($item in $tops){if($item.Current.ProcessId -eq $app.Id){$window=$item;break}}
  }
  if($null -eq $window){throw 'Native window not exposed to UI Automation'}
  Start-Sleep -Milliseconds 650
  function UIANames($w) {
    $out=New-Object 'System.Collections.Generic.List[string]'
    $nodes=$w.FindAll([System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition)
    foreach($node in $nodes){try{if($node.Current.Name){$out.Add($node.Current.Name)}}catch{}}
    return ,$out
  }
  $info=[ordered]@{schema='challenger.native.windows-a11y-qa.v1';
    mode=$Mode;session=(Get-Process -Id $PID).SessionId;verified=$false}
  if($Mode -eq 'shortcut'){
    $handle=[IntPtr]$window.Current.NativeWindowHandle
    [QaWindowFocus]::ShowWindow($handle,5)|Out-Null
    Start-Sleep -Milliseconds 200
    if(-not [QaWindowFocus]::SetForegroundWindow($handle)){throw 'Could not focus QA window'}
    [System.Windows.Forms.SendKeys]::SendWait('^,')
    Start-Sleep -Milliseconds 750
    $info.ctrlCommaOpens=(UIANames $window).Contains('Make Challenger yours.')
    if(-not $info.ctrlCommaOpens){throw 'Ctrl+, did not open Preferences'}
    [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
    Start-Sleep -Milliseconds 750
    $info.escapeCloses=-not (UIANames $window).Contains('Make Challenger yours.')
    if(-not $info.escapeCloses){throw 'Escape did not close Preferences'}
  } else {
    $nodes=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition)
    $info.elementCount=$nodes.Count
    $radios=New-Object 'System.Collections.Generic.List[string]'
    $focus=New-Object 'System.Collections.Generic.List[string]'
    foreach($node in $nodes){
      try{
        if($node.Current.ControlType -eq [System.Windows.Automation.ControlType]::RadioButton){
          $radios.Add($node.Current.Name)
        }
        if($node.Current.IsKeyboardFocusable -and $node.Current.Name){
          $focus.Add($node.Current.Name)
        }
      } catch{}
    }
    $info.radioChoices=$radios.ToArray()
    $info.keyboardFocusable=$focus.Count
    if($nodes.Count -lt 50){throw 'Incomplete UIA tree'}
    foreach($name in @('Accessibility','System','Reduce','Allow','Off','On')){
      if(-not ($radios -contains $name)){throw ('Missing accessible radio: '+$name)}
    }
    if(-not ($focus -contains 'Search software catalog')){throw 'Search is not focusable'}
  }
  $info.verified=$true
  $json=($info|ConvertTo-Json -Compress -Depth 4)
  if($ReportPath){Set-Content -LiteralPath $ReportPath -Value $json -Encoding UTF8}
  Write-Output $json
} finally {
  if(-not $app.HasExited){
    try{$app.CloseMainWindow()|Out-Null}catch{}
    if(-not $app.WaitForExit(1800)){
      Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
