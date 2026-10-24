@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在更新魔芋一夏...
git pull --ff-only
if errorlevel 1 ( echo 更新失敗，可能是本機有未提交的改動 & pause & exit /b 1 )
node tools\pack4.js
if errorlevel 1 ( echo 打包失敗 & pause & exit /b 1 )
set DEST=%LOCALAPPDATA%\Programs\魔芋一夏
echo 安裝到 %DEST%
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "dist\魔芋一夏" "%DEST%\" /e /i /y /q
echo 完成，請重新啟動 魔芋一夏
pause
