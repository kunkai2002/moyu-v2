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

' Electron already owns the global hotkeys (Alt+Q and Ctrl+Shift+Q),
' so the companion tray app is no longer started: one less process, one less tray icon.
If fso.FileExists(base & "\electron\electron.exe") Then
  sh.Run """" & base & "\electron\electron.exe"" """ & base & """ --data-dir=""" & base & "\data""", 0, False
Else
  sh.Run "node """ & base & "\server.js"" --open", 0, False
End If
