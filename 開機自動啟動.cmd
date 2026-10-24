@echo off
rem ASCII only. Install / remove the auto-start shortcut (silent launcher, no tunnel).
setlocal
set "APP=%~dp0"
if "%APP:~-1%"=="\" set "APP=%APP:~0,-1%"
wscript.exe //nologo "%APP%\tools\autostart.vbs" %1
pause
exit /b 0
