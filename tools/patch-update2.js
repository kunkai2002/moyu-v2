// 強化 update.cmd：寫日誌 + node 路徑 fallback
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);

const updateCmd = [
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
  'if not exist "%NODE%" if "%NODE%"=="node" set "NODE="',
  '',
  'pushd "%REPO%"',
  'echo [%DATE% %TIME%] start>>"%LOG%"',
  'git fetch --quiet >nul 2>&1',
  'set "LOCAL="',
  'set "REMOTE="',
  'for /f %%i in (\'git rev-parse HEAD 2^>nul\') do set "LOCAL=%%i"',
  'for /f %%i in (\'git rev-parse "@{u}" 2^>nul\') do set "REMOTE=%%i"',
  'echo   local=!LOCAL! remote=!REMOTE!>>"%LOG%"',
  'if "!LOCAL!"=="" goto :skip',
  'if "!LOCAL!"=="!REMOTE!" goto :skip',
  'git pull --ff-only --quiet >>"%LOG%" 2>&1 || goto :skip',
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
].join('\r\n');

fs.writeFileSync(p('tools/update.cmd'), updateCmd, 'ascii');
console.log('update.cmd rewritten');
