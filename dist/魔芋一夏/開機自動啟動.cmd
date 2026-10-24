@echo off
rem ASCII only. Installs / removes the auto-start shortcut.
chcp 65001 >nul
cd /d "%~dp0"

if /i "%~1"=="remove" goto remove
if /i "%~1"=="--remove" goto remove

echo Installing auto-start (tunnel + server) ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws=New-Object -ComObject WScript.Shell;" ^
  "$lnk=$ws.CreateShortcut([Environment]::GetFolderPath('Startup')+'\MoyuTunnel.lnk');" ^
  "$lnk.TargetPath='%WINDIR%\System32\wscript.exe';" ^
  "$lnk.Arguments='//nologo \"%~dp0tools\tunnel-launch.vbs\"';" ^
  "$lnk.WorkingDirectory='%~dp0';" ^
  "$lnk.Description='Moyu tunnel';" ^
  "$lnk.Save();"
if errorlevel 1 ( echo [x] failed & pause & exit /b 1 )
echo [ok] auto-start installed.
echo      remove: run this file with argument remove
pause
exit /b 0

:remove
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Remove-Item ([Environment]::GetFolderPath('Startup')+'\MoyuTunnel.lnk') -Force -ErrorAction SilentlyContinue;"
echo [ok] auto-start removed.
pause
exit /b 0
