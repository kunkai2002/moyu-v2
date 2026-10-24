// 更新機制：/api/update/apply + 更新.cmd + 註冊 polish.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 1. 更新.cmd（在原始碼庫上跑，然後重裝）── */
const updCmd = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在更新魔芋一夏...
git pull --ff-only
if errorlevel 1 ( echo 更新失敗，可能是本機有未提交的改動 & pause & exit /b 1 )
node tools\\pack4.js
if errorlevel 1 ( echo 打包失敗 & pause & exit /b 1 )
set DEST=%LOCALAPPDATA%\\Programs\\魔芋一夏
echo 安裝到 %DEST%
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "dist\\魔芋一夏" "%DEST%\\" /e /i /y /q
echo 完成，請重新啟動 魔芋一夏
pause
`;
fs.writeFileSync(path.join(ROOT, '更新.cmd'), updCmd.replace(/\n/g, '\r\n'), 'utf8');
console.log('+ 更新.cmd');

/* ── 2. server.js：/api/update/apply ── */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes("'/api/update/apply'")) {
  const anchor = "    if (p === '/api/health') {";
  const route = `    if (p === '/api/update/apply') {
      // 安裝版沒有原始碼庫，無法自我更新；告知使用者跑更新腳本
      const repo = process.env.MOYU_SRC || 'D:\\\\kun-workspace\\\\moyu-v2';
      const hasRepo = fs.existsSync(path.join(repo, 'server.js')) && fs.existsSync(path.join(repo, '更新.cmd'));
      return json(res, 200, {
        ok: true,
        applied: false,
        needReinstall: true,
        repo,
        message: hasRepo
          ? '請關掉程式，然後執行 ' + repo + '\\\\更新.cmd，完成後重新啟動'
          : '請重新解壓最新版覆蓋安裝目錄',
      });
    }

${anchor}`;
  if (s.includes(anchor)) { fs.writeFileSync(sp, s.replace(anchor, route), 'utf8'); console.log('+ /api/update/apply'); }
}

/* ── 3. bridge.update.apply ── */
const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('apply:')) {
  b = b.replace("update: { check: () => api('/api/update') },",
    "update: { check: () => api('/api/update'), apply: () => post('/api/update/apply', {}) },");
  fs.writeFileSync(bp, b, 'utf8');
  console.log('+ bridge.update.apply');
}

/* ── 4. index.html 掛 polish.js（最後）── */
const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('polish.js')) {
  h = h.replace('<script src="chrome.js"></script>',
    '<script src="chrome.js"></script>\n<script src="polish.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 polish.js');
}

/* ── 5. pack4 ── */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('polish.js')) {
  p = p.replace("'ui/chrome.js',", "'ui/chrome.js', 'ui/polish.js', '更新.cmd',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 polish.js / 更新.cmd');
}
