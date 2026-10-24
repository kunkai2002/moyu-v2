// 移除防截圖：Electron 端的 setContentProtection + companion 的 WDA
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* 1. main.js：清掉 setContentProtection */
const mp = path.join(ROOT, 'main.js');
let m = fs.readFileSync(mp, 'utf8');
let n = 0;

m = m.replace(/  protectScreen: true,[^\n]*\n/, '  // 防截圖已移除\n');
m = m.replace(/\s*if \(settings\.protectScreen\) win\.setContentProtection\(true\);/, '');
m = m.replace(/\s*if \(patch\.protectScreen !== undefined && win\) win\.setContentProtection\(!!patch\.protectScreen\);/, '');
if (m.includes('setContentProtection')) {
  m = m.replace(/win\.setContentProtection\([^)]*\);/g, '/* removed */');
  n++;
}
fs.writeFileSync(mp, m, 'utf8');
console.log('main.js 仍含 setContentProtection:', m.includes('setContentProtection'));

/* 2. start.vbs：companion 加 --no-protect（保留全域 Alt+Q） */
const sp = path.join(ROOT, 'tools', 'start.vbs');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes('--no-protect')) {
  s = s.replace('--title=api-server --port=47821', '--title=api-server --port=47821 --no-protect');
  fs.writeFileSync(sp, s, 'utf8');
  console.log('+ start.vbs: companion 以 --no-protect 啟動');
} else console.log('= 已有 --no-protect');

/* 3. 桌面 UI 若還有殘留說明也移除 */
const wp = path.join(ROOT, 'ui', 'wiring.js');
if (fs.existsSync(wp)) {
  let w = fs.readFileSync(wp, 'utf8');
  if (w.includes('防截圖')) {
    w = w.replace(/[^\n]*防截圖[^\n]*\n/g, '');
    fs.writeFileSync(wp, w, 'utf8');
    console.log('+ wiring.js 移除防截圖說明');
  }
}
