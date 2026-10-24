@echo off
rem ASCII only. Starts the LAN server, then a Cloudflare quick tunnel.
chcp 65001 >nul
cd /d "%~dp0"

if not exist "tools\bin\cloudflared.exe" (
  echo [x] tools\bin\cloudflared.exe not found
  pause
  exit /b 1
)

echo Starting local server...
start "" /min cmd /c "node server.js --open"
timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo  Cloudflare Tunnel starting...
echo  Look for the https://....trycloudflare.com line below.
echo  Open that URL on your phone (add /m/ for mobile).
echo  Keep this window open. Close it to stop the tunnel.
echo ============================================
echo.

tools\bin\cloudflared.exe tunnel --url http://127.0.0.1:47821 --no-autoupdate

pause
