@echo off
rem ASCII only. Hands over to the silent launcher immediately.
start "" wscript.exe //nologo "%~dp0tools\launch.vbs"
exit /b 0
