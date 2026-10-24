// update.cmd v3：遠端比對改用 origin/<branch> 並帶 fallback，避免 upstream 未設定時靜默跳過
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);

const lines = [
  '@echo off',
  'rem ASCII only. Silent self-update: pack + copy only when the remote moved.',
  'setlocal enabledelayedexpansion',
  'set "REPO=D:\\kun-workspace\\moyu-v2"',
  'set "APP=%~dp0.."',
  'set "LOG=%APP%\\tools\\update.log"',
  'if not exist "%REPO%\\server.js" exit /b 0',
  '',
  'set "NODE=node"',
  'where node >nul 2>&1 || set "NODE=%ProgramFiles%\\nodejs\\node.exe"',
  '',
  'pushd "%REPO%"',
  'echo [%DATE% %TIME%] start>>"%LOG%"',
  'git fetch --quiet origin >>"%LOG%" 2>&1',
  'set "LOCAL="',
  'set "REMOTE="',
  'for /f %%i in (\'git rev-parse HEAD 2^>nul\') do set "LOCAL=%%i"',
  'for /f %%i in (\'git rev-parse origin/main 2^>nul\') do set "REMOTE=%%i"',
  'if "!REMOTE!"=="" for /f %%i in (\'git rev-parse "@{u}" 2^>nul\') do set "REMOTE=%%i"',
  'echo   local=!LOCAL! remote=!REMOTE!>>"%LOG%"',
  'if "!LOCAL!"=="" goto :skip',
  'if "!REMOTE!"=="" goto :skip',
  'if "!LOCAL!"=="!REMOTE!" goto :skip',
  'git pull --ff-only --quiet origin main >>"%LOG%" 2>&1 || goto :skip',
  'if "!NODE!"=="" goto :skip',
  '"!NODE!" tools\\pack4.js >>"%LOG%" 2>&1 || goto :skip',
  'if /i "!APP!"=="%REPO%" goto :done',
  'xcopy "dist\\魔芋一夏\\*" "!APP!\\." /e /i /y /q >>"%LOG%" 2>&1',
  'echo   deployed>>"%LOG%"',
  'goto :done',
  ':skip',
  'echo   no-op>>"%LOG%"',
  ':done',
  'popd',
  'exit /b 0',
  ''
];
fs.writeFileSync(p('tools/update.cmd'), lines.join('\r\n'), 'ascii');
console.log('update.cmd v3 written');
