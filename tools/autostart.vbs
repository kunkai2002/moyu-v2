' Moyu auto-start installer. ASCII ONLY.
Option Explicit
Dim fso, sh, base, lnkPath, sc, arg
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
lnkPath = sh.SpecialFolders("Startup") & "\Moyu.lnk"
arg = ""
If WScript.Arguments.Count > 0 Then arg = LCase(WScript.Arguments(0))

If arg = "remove" Then
  If fso.FileExists(lnkPath) Then fso.DeleteFile lnkPath, True
  WScript.Echo "removed: " & lnkPath
  WScript.Quit 0
End If

Set sc = sh.CreateShortcut(lnkPath)
sc.TargetPath = sh.ExpandEnvironmentStrings("%WINDIR%") & "\System32\wscript.exe"
sc.Arguments = "//nologo """ & base & "\tools\launch.vbs"""
sc.WorkingDirectory = base
sc.Description = "Moyu"
sc.Save
WScript.Echo "installed: " & lnkPath
