@echo off
rem ASCII only. Do not add non-ASCII characters to this file.
cd /d "%~dp0"
start "" wscript.exe //nologo "%~dp0tools\start.vbs"
exit /b 0
