@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" wscript //nologo "%~dp0tools\start.vbs"
exit /b 0
