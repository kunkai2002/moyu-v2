@echo off
rem ASCII only. Pulls updates (if the source repo exists), then launches the app.
setlocal
cd /d "%~dp0"

set "REPO=D:\kun-workspace\moyu-v2"

if exist "%REPO%\server.js" (
  if exist "%REPO%\tools\pack4.js" (
    pushd "%REPO%"
    git pull --ff-only --quiet >nul 2>&1
    if not errorlevel 1 (
      node tools\pack4.js >nul 2>&1
      if not errorlevel 1 (
        xcopy "dist\魔芋一夏\*" "%~dp0." /e /i /y /q >nul 2>&1
      )
    )
    popd
  )
)

start "" wscript.exe //nologo "%~dp0tools\start.vbs"
exit /b 0
