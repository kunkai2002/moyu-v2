/* 建立測試站（staging）安裝：%LOCALAPPDATA%\Programs\魔芋一夏-staging
   - 從正式版複製程式（不含 data）
   - data\env.json = {"env":"staging"} → 更新器只跟 cloud 的 s/ 那一份
   - 複製 sync.json / prefs.json / window.json，登入與外觀跟正式版一樣 */
const fs = require('fs');
const path = require('path');

const LOCAL = process.env.LOCALAPPDATA;
const PROD = path.join(LOCAL, 'Programs', '魔芋一夏');
const STG = path.join(LOCAL, 'Programs', '魔芋一夏-staging');

function copyDir(src, dst, filter) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (filter && !filter(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(PROD)) { console.error('找不到正式版安裝：' + PROD); process.exit(1); }

/* 程式本體（data 除外） */
copyDir(PROD, STG, (n) => n !== 'data');

/* 自己的 data：只帶必要的，其他讓程式自己長 */
const sd = path.join(STG, 'data');
fs.mkdirSync(sd, { recursive: true });
for (const f of ['sync.json', 'prefs.json', 'settings.json', 'window.json']) {
  const src = path.join(PROD, 'data', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sd, f));
}
fs.writeFileSync(path.join(sd, 'env.json'), JSON.stringify({ env: 'staging' }, null, 2), 'utf8');

/* 啟動器（不要放桌面捷徑，避免跟正式版搞混） */
const cmd = `@echo off\r\ncd /d "%~dp0"\r\nstart "" "electron\\electron.exe" "%~dp0." %*\r\n`;
fs.writeFileSync(path.join(STG, '啟動-staging.cmd'), cmd, 'utf8');

console.log('✓ 測試站安裝完成：' + STG);
console.log('  啟動：' + path.join(STG, '啟動-staging.cmd'));
console.log('  資料：' + sd + '（env.json = staging）');
