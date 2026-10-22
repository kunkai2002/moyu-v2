' Moyu v2 hidden launcher. ASCII ONLY - WScript reads .vbs as ANSI,
' so any non-ASCII byte in this file can break parsing.
Option Explicit

Dim fso, sh, base, comp, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
If base = "" Then base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base

' 1) start local server (it opens the Chrome app window itself)
cmd = "node """ & base & "\server.js"" --open"
sh.Run cmd, 0, False

' 2) wait a moment, then start the companion (global Alt+Q + capture protection)
WScript.Sleep 2500

comp = base & "\companion\MoyuCompanion.exe"
If fso.FileExists(comp) Then
  sh.Run """" & comp & """ --title=api-server --port=47821", 0, False
End If
