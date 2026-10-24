' Moyu v2 silent launcher. ASCII ONLY.
' Runs the self-update hidden, then starts the app hidden. No console window ever appears.
Option Explicit

Dim fso, sh, base, upd

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
On Error Resume Next
sh.CurrentDirectory = base
On Error GoTo 0

upd = base & "\tools\update.cmd"
If fso.FileExists(upd) Then
  sh.Run """" & upd & """", 0, True
End If

sh.Run "wscript.exe //nologo """ & base & "\tools\start.vbs""", 0, False
