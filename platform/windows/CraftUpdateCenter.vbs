Option Explicit
Dim sh, command, code
Set sh=CreateObject("WScript.Shell")
command="powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""D:\Velvet\Installers\CraftSuite\Center\Start-Center.ps1"""
code=sh.Run(command,0,True)
If code=0 Then
  sh.Run "http://127.0.0.1:17873/",1,False
Else
  MsgBox "Could not start Craft Update Center (code " & code & "). Check Windows administrator approval and installation logs.", vbExclamation, "Craft Update Center"
End If
