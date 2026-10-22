' 魔芋一夏 · 隱藏啟動（不開黑框）
' 1) 起本機服務並開 Chrome 應用程式視窗
' 2) 起搭檔程式：全域 Alt+Q ＋ 防截圖
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = base

sh.Run "node """ & base & "\server.js"" --open", 0, False
WScript.Sleep 2500

comp = base & "\companion\MoyuCompanion.exe"
If fso.FileExists(comp) Then
  sh.Run """" & comp & """ --title=api-server --port=47821", 0, False
End If
