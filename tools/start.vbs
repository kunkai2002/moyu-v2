' Moyu v2 launcher. ASCII ONLY. No PowerShell, no long string concat.
' Lives in <app>\tools\, so base = two levels up.
Option Explicit

Dim fso, sh, base

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
On Error Resume Next
sh.CurrentDirectory = base
On Error GoTo 0

If fso.FileExists(base & "\electron\electron.exe") Then
  sh.Run """" & base & "\electron\electron.exe"" """ & base & """ --data-dir=""" & base & "\data""", 0, False
Else
  sh.Run "node """ & base & "\server.js"" --open", 0, False
End If

If fso.FileExists(base & "\companion\MoyuCompanion.exe") Then
  sh.Run """" & base & "\companion\MoyuCompanion.exe"" --title=api-server --port=47821", 0, False
End If
