' Moyu v2 launcher. ASCII ONLY (WScript reads .vbs as ANSI).
' Order: optional silent auto-update -> Electron shell -> fallback Chrome.
' This file lives in <app>\tools\, so base = two levels up.
Option Explicit

Dim fso, sh, base, repo, electron, comp, ps, rc

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = base

repo = "D:\kun-workspace\moyu-v2"

' ---------- 1) silent auto-update (only if the source repo is present) ----------
If fso.FolderExists(repo) Then
  If fso.FileExists(repo & "\server.js") Then
    ps = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command " & _
         """$ErrorActionPreference='SilentlyContinue'; Set-Location '" & repo & "'; " & _
         "git pull --ff-only --quiet 2>$null; " & _
         "if ($LASTEXITCODE -eq 0) { node tools\pack4.js | Out-Null; " & _
         "if ($LASTEXITCODE -eq 0) { Copy-Item 'dist\*' '" & base & "' -Recurse -Force } }"""
    rc = sh.Run(ps, 0, True)
  End If
End If

' ---------- 2) start the app ----------
electron = base & "\electron\electron.exe"

If fso.FileExists(electron) Then
  sh.Run """" & electron & """ """ & base & """ --data-dir=""" & base & "\data""", 0, False
Else
  sh.Run "node """ & base & "\server.js"" --open", 0, False
  WScript.Sleep 2500
End If

' ---------- 3) companion (global hotkey + capture protection) ----------
comp = base & "\companion\MoyuCompanion.exe"
If fso.FileExists(comp) Then
  sh.Run """" & comp & """ --title=api-server --port=47821", 0, False
End If
