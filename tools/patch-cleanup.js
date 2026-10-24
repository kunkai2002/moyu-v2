// 清掉廢棄功能：手機版 PWA、Cloudflare 隧道、companion 托盤程式
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rm = (rel) => {
  const full = p(rel);
  if (!fs.existsSync(full)) return console.log('  略過（不存在）', rel);
  fs.rmSync(full, { recursive: true, force: true });
  console.log('  刪除', rel);
};

/* ── 檔案 ─────────────────────────────────────────────────── */
console.log('檔案：');
rm('ui/m');
rm('companion');
rm('dist_moyu_companion');
rm('隧道.cmd');
rm('更新.cmd');
rm('tools/tunnel-daemon.ps1');
rm('tools/tunnel-launch.vbs');
rm('tools/bin');

/* ── server.js ────────────────────────────────────────────── */
{
  const f = p('server.js');
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  s = s.replace(/\r?\n  if \(p === '\/m' \|\| p === '\/m\/'\) p = '\/m\/index\.html';/, '');
  s = s.replace(/\r?\n  '\.webmanifest': 'application\/manifest\+json; charset=utf-8',/, '');
  s = s.replace(/\r?\n    if \(p === '\/api\/tunnel'\) \{[\s\S]*?\r?\n    \}\r?\n/, '\n');
  s = s.replace(/\r?\n          console\.log\(`  手機版 http:\/\/\$\{n\.address\}:\$\{PORT\}\/m\/`\);/, '');
  if (s === before) { console.error('❌ server.js 沒有變更，錨點可能失效'); process.exit(1); }
  fs.writeFileSync(f, s, 'utf8');
  console.log('server.js 已清掉 /m、/api/tunnel、手機版網址');
}

/* ── tools/autostart.vbs（開機自動啟動用，ASCII）─────────── */
{
  const vbs = [
    "' Moyu auto-start installer. ASCII ONLY.",
    "Option Explicit",
    "Dim fso, sh, base, lnkPath, sc, arg",
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set sh  = CreateObject("WScript.Shell")',
    "base = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))",
    'lnkPath = sh.SpecialFolders("Startup") & "\\Moyu.lnk"',
    "arg = \"\"",
    "If WScript.Arguments.Count > 0 Then arg = LCase(WScript.Arguments(0))",
    "",
    'If arg = "remove" Then',
    "  If fso.FileExists(lnkPath) Then fso.DeleteFile lnkPath, True",
    '  WScript.Echo "removed: " & lnkPath',
    "  WScript.Quit 0",
    "End If",
    "",
    "Set sc = sh.CreateShortcut(lnkPath)",
    'sc.TargetPath = sh.ExpandEnvironmentStrings("%WINDIR%") & "\\System32\\wscript.exe"',
    'sc.Arguments = "//nologo """ & base & "\\tools\\launch.vbs"""',
    "sc.WorkingDirectory = base",
    'sc.Description = "Moyu"',
    "sc.Save",
    'WScript.Echo "installed: " & lnkPath',
    ""
  ].join('\r\n');
  fs.writeFileSync(p('tools/autostart.vbs'), vbs, 'ascii');
  console.log('tools/autostart.vbs 已建立');
}

/* ── 開機自動啟動.cmd ─────────────────────────────────────── */
{
  const cmd = [
    '@echo off',
    'rem ASCII only. Install / remove the auto-start shortcut (silent launcher, no tunnel).',
    'setlocal',
    'set "APP=%~dp0"',
    'if "%APP:~-1%"=="\\" set "APP=%APP:~0,-1%"',
    'wscript.exe //nologo "%APP%\\tools\\autostart.vbs" %1',
    'pause',
    'exit /b 0',
    ''
  ].join('\r\n');
  fs.writeFileSync(p('開機自動啟動.cmd'), cmd, 'ascii');
  console.log('開機自動啟動.cmd 已改寫');
}

/* ── pack4.js ─────────────────────────────────────────────── */
{
  const f = p('tools/pack4.js');
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/, 'ui\/m\/index\.html', 'ui\/m\/m\.css', 'ui\/m\/m\.js', 'ui\/m\/manifest\.webmanifest', 'ui\/m\/sw\.js'/, '');
  s = s.replace(/, '更新\.cmd', '隧道\.cmd', '開機自動啟動\.cmd', 'tools\/tunnel-daemon\.ps1', 'tools\/tunnel-launch\.vbs'/, ", '開機自動啟動.cmd', 'tools/autostart.vbs'");
  s = s.replace(/const COMP = path\.join\(ROOT, 'dist_moyu_companion'\);[\s\S]*?\r?\n\}\r?\n\r?\n/, '');
  fs.writeFileSync(f, s, 'utf8');
  console.log('pack4.js 已更新');
}
