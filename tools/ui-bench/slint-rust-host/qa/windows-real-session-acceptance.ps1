param(
  [Parameter(Mandatory=$true)][string]$Executable,
  [Parameter(Mandatory=$true)][string]$OutputRoot
)
$ErrorActionPreference='Stop'
$session=(Get-Process -Id $PID).SessionId
if($session -eq 0){throw 'Refusing Session 0 UI acceptance'}
if(!(Test-Path -LiteralPath $Executable -PathType Leaf)){throw 'Exact beta executable missing'}
if($OutputRoot -notmatch '(?i)Challenger-Beta-QA'){throw 'Refusing output outside QA folder'}
New-Item -ItemType Directory -Force -Path $OutputRoot|Out-Null
$infoPath=Join-Path (Split-Path (Split-Path (Split-Path $Executable -Parent) -Parent) -Parent) 'BUILD_INFO.json'
if(!(Test-Path $infoPath)){throw 'Build provenance file missing'}
$build=Get-Content $infoPath -Raw|ConvertFrom-Json
if($build.repository -ne 'velvet-workspace/challenger-hub' -or $build.publicRelease -ne $false -or $build.noUserInstallation -ne $true){throw 'Untrusted or public build'}
$env:APPDATA=Join-Path $OutputRoot 'isolated-appdata-interactive'
$env:SLINT_BACKEND='winit-software'
$env:CHALLENGER_REDUCED_MOTION='1'
$env:CHALLENGER_DISABLE_SCAN='1'
New-Item -ItemType Directory -Force -Path $env:APPDATA|Out-Null
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ChallengerQAWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd,int show);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
}
'@
$caseList=New-Object System.Collections.Generic.List[object]
function Record([string]$name,[bool]$passed,[string]$detail) {
 $caseList.Add([ordered]@{name=$name;passed=$passed;detail=$detail})
}
function Nodes {
 return ,$script:win.FindAll([System.Windows.Automation.TreeScope]::Descendants,
  [System.Windows.Automation.Condition]::TrueCondition)
}
function FindElement([string]$name,[int]$timeoutMs=6000) {
 $timer=[Diagnostics.Stopwatch]::StartNew()
 do {
  $fallback=$null
  foreach($element in (Nodes)){
   try{
    if($element.Current.Name -ne $name){continue}
    $role=$element.Current.ControlType.ProgrammaticName
    if($role -match 'Button|RadioButton|Edit|TextBox|CheckBox'){return $element}
    if(!$fallback){$fallback=$element}
   }catch{}
  }
  if($fallback){return $fallback}
  Start-Sleep -Milliseconds 160
 } while($timer.ElapsedMilliseconds -lt $timeoutMs)
 return $null
}
function AllNames {
 $list=New-Object System.Collections.Generic.List[string]
 foreach($element in (Nodes)){try{$name=$element.Current.Name;if($name){$list.Add($name)}}catch{}}
 return ,$list.ToArray()
}
function FocusWindow {
 $hwnd=[IntPtr]$script:win.Current.NativeWindowHandle
 [ChallengerQAWindow]::ShowWindow($hwnd,5)|Out-Null
 [ChallengerQAWindow]::SetForegroundWindow($hwnd)|Out-Null
}
function Activate([string]$name) {
 $element=FindElement $name 6800
 if(!$element){throw ('Missing interactive control: '+$name)}
 try{
  $invoke=$element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  if($invoke){$invoke.Invoke();Start-Sleep -Milliseconds 500;return 'InvokePattern'}
 }catch{}
 try{
  $select=$element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
  if($select){$select.Select();Start-Sleep -Milliseconds 500;return 'SelectionItem'}
 }catch{}
 FocusWindow
 try {
   $element.SetFocus()
   [System.Windows.Forms.SendKeys]::SendWait(' ')
   Start-Sleep -Milliseconds 500
   return 'Keyboard Space'
 } catch {
   $rect=$element.Current.BoundingRectangle
   if($rect.Width -lt 6 -or $rect.Height -lt 6){throw ('No clickable rect for '+$name)}
   $x=[int]($rect.Left+$rect.Width/2);$y=[int]($rect.Top+$rect.Height/2)
   [ChallengerQAWindow]::SetCursorPos($x,$y)|Out-Null
   [ChallengerQAWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
   Start-Sleep -Milliseconds 100
   [ChallengerQAWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
   Start-Sleep -Milliseconds 600
   return 'Native mouse click'
 }
}
function WaitName([string]$label,[int]$timeoutMs=7000) {
 $e=FindElement $label $timeoutMs
 if(!$e){throw ('Expected native UIA label missing: '+$label)}
 return $e
}
function RunCase([string]$name,[scriptblock]$body){
 try {
  $detail=& $body
  Record $name $true ([string]$detail)
 }catch{
  Record $name $false ([string]$_)
 }
}
$app=Start-Process -FilePath $Executable -PassThru
try{
 $root=[System.Windows.Automation.AutomationElement]::RootElement
 $win=$null
 for($i=0;$i -lt 70 -and !$win;$i++){
   Start-Sleep -Milliseconds 300
   foreach($w in $root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)){
    try{if($w.Current.ProcessId -eq $app.Id){$win=$w;break}}catch{}
   }
 }
 if(!$win){throw 'No real native Challenger window found in logged-in user session'}
 FocusWindow
 RunCase 'Home accessible navigation' {
  foreach($n in @('Discover software','Browse full software catalog','My software','Activity','Open Preferences, appearance, accessibility and about','Refresh catalog')){
    $null=WaitName $n
  }
  'Six native navigation/actions present'
 }
 RunCase 'Browse all real catalog results' {
  $mode=Activate 'Browse full software catalog'
  $null=WaitName 'Search software catalog' 9000
  $count=0
  for($i=0;$i -lt 30 -and $count -eq 0;$i++){
    $names=AllNames
    $count=@($names|Where-Object {$_ -match '^Explore '}).Count
    if($count -eq 0){Start-Sleep -Milliseconds 200}
  }
  if($count -eq 0){throw ('No accessible Explore cards after browsing: '+(($names|Select-Object -First 14) -join '|'))}
  'Browsable source-linked results ('+$count+' accessible cards); '+$mode
 }
 RunCase 'Native search and project dossier' {
  $line=WaitName 'Search software catalog'
  FocusWindow
  $line.SetFocus()
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  [System.Windows.Forms.SendKeys]::SendWait('Material Maker')
  $method='Actual keyboard typing'
  Start-Sleep -Milliseconds 330
  try{
   $value=$line.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
   if($value -ne 'Material Maker'){throw ('Search input did not retain typed text: '+$value)}
  }catch{throw ('Search ValuePattern verification failed: '+$_)}

  Start-Sleep -Milliseconds 850
  $item=FindElement 'Explore Material Maker' 5000
  if(!$item){throw ('Expected Material Maker search result missing; names='+((AllNames | Select-Object -First 25)-join '|'))}
  $action=Activate 'Explore Material Maker'
  $null=WaitName 'Back to results'
  $text=AllNames
  if(-not (@($text|Where-Object {$_ -match 'Source listing alone does not authorize'}).Count)){throw 'Project source/permission disclaimer missing'}
  $back=Activate 'Back to results'
  $null=WaitName 'Search software catalog'
  "Search via $method; dossier via $action; return via $back"
 }
 RunCase 'My software read-only inventory' {
  $nav=Activate 'My software'
  $null=WaitName 'Software on this device.'
  $null=WaitName 'Inspect OS app registrations'
  $text=AllNames
  if(-not (@($text|Where-Object {$_ -match 'Not detected does not mean uninstalled|not.*inferred'}).Count)){throw 'No honest status disclaimer'}
  "Managed-only inventory shown; $nav"
 }
 RunCase 'Preferences and About/Updates accessible' {
  $nav=Activate 'Open Preferences, appearance, accessibility and about'
  $null=WaitName 'Make Challenger yours.'
  $about=Activate 'About & Updates'
  $null=WaitName 'About Challenger'
  $null=WaitName 'Check updates'
  "About pane available; $nav / $about; no automatic release checks"
 }
 RunCase 'Manual native update check reports accurate result' {
  $clicked=Activate 'Check updates'
  $status='';$timer=[Diagnostics.Stopwatch]::StartNew()
  do {
   Start-Sleep -Milliseconds 450
   $text=AllNames
   foreach($v in $text){
    if($v -match 'No compatible verified native release|Official release check unavailable|Update check unavailable|Update checker returned|verified native release.*available|native developer build is at least'){ $status=$v;break}
   }
  }while(!$status -and $timer.ElapsedMilliseconds -lt 17000)
  if(!$status){throw 'No final status from manual update check'}
  if($status -notmatch 'No compatible verified native release|native developer build is at least|verified native release.*available'){
    throw ('Official update check error shown: '+$status)
  }
  $status
 }
 RunCase 'Dismiss Preferences with Escape' {
  FocusWindow
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  Start-Sleep -Milliseconds 500
  if(FindElement 'Make Challenger yours.' 700){throw 'Preferences did not close'}
  'Native escape closed Preferences'
 }
 RunCase 'Activity truthful session view' {
  $nav=Activate 'Activity'
  $text=AllNames
  if(-not (@($text|Where-Object {$_ -match 'Session log is memory-only'}).Count)){throw 'Session-only activity disclaimer absent'}
  "Activity read-only; $nav"
 }
}finally{
 if(!$app.HasExited){
  try{$app.CloseMainWindow()|Out-Null}catch{}
  if(-not $app.WaitForExit(1500)){Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue}
 }
 $all=@($caseList.ToArray())
 $summary=[ordered]@{schema='challenger.native.windows.real-session-acceptance.v1'
   provenanceHead=$build.pullRequestHeadCommit;checkoutCommit=$build.checkoutCommit;session=$session
   cases=$all;passed=@($all|Where-Object{$_.passed}).Count
   failed=@($all|Where-Object{-not $_.passed}).Count
   noInstallation=$true;isolatedAppdata=$env:APPDATA}
 $json=$summary|ConvertTo-Json -Depth 6
 $json|Set-Content -LiteralPath (Join-Path $OutputRoot 'windows-real-session-acceptance-v2.json') -Encoding UTF8
 $json
}
if($summary.failed -gt 0){throw ('Interactive native acceptance failed '+$summary.failed+' of '+$summary.cases.Count+' cases')}
