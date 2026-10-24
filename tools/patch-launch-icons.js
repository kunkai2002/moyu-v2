// 一次性修補：① 全域 svg 100% 撐爆圖標 ② 啟動黑窗 ③ 個別過大圖標
const fs = require('fs');
const p = (s) => require('path').join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');
let changed = [];

/* ── ① theme.css：不再讓所有 svg 強制填滿父容器 ───────────── */
{
  const f = 'ui/theme.css';
  let s = rd(f);
  const before = s;
  s = s.replace(
    'svg{display:block;width:100%;height:100%}',
    '/* 圖標尺寸一律由 svg 自身的 width/height 屬性決定；只有明確要填滿容器的才加 .fit */\n'
    + 'svg{display:block;flex:none}\n'
    + 'svg.fit{width:100%;height:100%}'
  );
  if (s !== before) { wr(f, s); changed.push(f); }
}

/* ── ② 個別偏大的圖標統一到 16 ────────────────────────────── */
{
  const f = 'ui/chrome.js';
  let s = rd(f);
  const before = s;
  s = s.replace("I.svg(ICON_FOR[key] || 'note', 17)", "I.svg(ICON_FOR[key] || 'note', 16)");
  if (s !== before) { wr(f, s); changed.push(f); }
}
{
  const f = 'ui/polish.js';
  let s = rd(f);
  const before = s;
  s = s.replace("btn.innerHTML = I.svg('book', 18);", "btn.innerHTML = I.svg('book', 16);");
  if (s !== before) { wr(f, s); changed.push(f); }
}

/* ── ③ 啟動：完全無黑窗 ───────────────────────────────────── */
{
  // 更新腳本（ASCII），只在有新提交時才打包替換
  const updateCmd = [
    '@echo off',
    'rem ASCII only. Silent self-update: only runs pack + copy when the remote moved.',
    'setlocal',
    'set "REPO=D:\\kun-workspace\\moyu-v2"',
    'if not exist "%REPO%\\server.js" exit /b 0',
    'pushd "%REPO%"',
    'git fetch --quiet >nul 2>&1',
    'set "LOCAL="',
    'set "REMOTE="',
    'for /f %%i in (\'git rev-parse HEAD 2^>nul\') do set "LOCAL=%%i"',
    'for /f %%i in (\'git rev-parse "@{u}" 2^>nul\') do set "REMOTE=%%i"',
    'if "%LOCAL%"=="" goto :done',
    'if "%LOCAL%"=="%REMOTE%" goto :done',
    'git pull --ff-only --quiet >nul 2>&1 || goto :done',
    'node tools\\pack4.js >nul 2>&1 || goto :done',
    'if /i "%~dp0.."=="%REPO%" goto :done',
    'xcopy "dist\\魔芋一夏\\*" "%~dp0..\\." /e /i /y /q >nul 2>&1',
    ':done',
    'popd',
    'exit /b 0',
    ''
  ].join('\r\n');
  fs.writeFileSync(p('tools/update.cmd'), updateCmd, 'ascii');
  changed.push('tools/update.cmd');

  const launchVbs = [
    "' Moyu v2 silent launcher. ASCII ONLY.",
    "' Runs the self-update hidden, then starts the app hidden. No console window ever appears.",
    'Option Explicit',
    '',
    'Dim fso, sh, base, upd',
    '',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set sh  = CreateObject("WScript.Shell")',
    '',
    'base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))',
    'On Error Resume Next',
    'sh.CurrentDirectory = base',
    'On Error GoTo 0',
    '',
    'upd = base & "\\tools\\update.cmd"',
    'If fso.FileExists(upd) Then',
    '  sh.Run """" & upd & """", 0, True',
    'End If',
    '',
    'sh.Run "wscript.exe //nologo """ & base & "\\tools\\start.vbs""", 0, False',
    ''
  ].join('\r\n');
  fs.writeFileSync(p('tools/launch.vbs'), launchVbs, 'ascii');
  changed.push('tools/launch.vbs');

  const boot = [
    '@echo off',
    'rem ASCII only. Hands over to the silent launcher immediately.',
    'start "" wscript.exe //nologo "%~dp0tools\\launch.vbs"',
    'exit /b 0',
    ''
  ].join('\r\n');
  fs.writeFileSync(p('啟動.cmd'), boot, 'ascii');
  changed.push('啟動.cmd');
}

console.log('patched:', changed.join(', '));
