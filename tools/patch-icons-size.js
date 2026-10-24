/* 圖標尺寸矯正：桌面 16px、按鈕 28px；手機 19px */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* chrome.js */
const cp = path.join(ROOT, 'ui', 'chrome.js');
let c = fs.readFileSync(cp, 'utf8');
c = c.replace(/I\.svg\(icon, 18\)/g, 'I.svg(icon, 16)');
c = c.replace(/I\.svg\(icon, 17\)/g, 'I.svg(icon, 15)');
c = c.replace(/I\.svg\('back', 15\)/g, "I.svg('back', 14)");
c = c.replace(/I\.svg\('forward', 15\)/g, "I.svg('forward', 14)");
c = c.replace(
  '.tb-btn{width:30px;height:30px;border-radius:7px',
  '.tb-btn{width:28px;height:28px;border-radius:6px',
);
c = c.replace(
  '.cn-btn{display:flex;align-items:center;gap:5px;white-space:nowrap;border:1px solid var(--line);\n    border-radius:16px;padding:5px 12px;',
  '.cn-btn{display:flex;align-items:center;justify-content:center;white-space:nowrap;border:1px solid var(--line);\n    border-radius:14px;padding:0;width:28px;height:28px;',
);
fs.writeFileSync(cp, c, 'utf8');
console.log('+ chrome.js 圖標縮小（16px / 28px 按鈕）');

/* polish.js 的翻章鈕也縮 */
const pp2 = path.join(ROOT, 'ui', 'polish.js');
let pl = fs.readFileSync(pp2, 'utf8');
pl = pl.replace('.cn-btn{padding:0;width:30px;height:30px;border-radius:50%;justify-content:center;gap:0}',
  '.cn-btn{padding:0;width:28px;height:28px;border-radius:50%;justify-content:center;gap:0}');
fs.writeFileSync(pp2, pl, 'utf8');

/* m.css 手機 */
const mp = path.join(ROOT, 'ui', 'm', 'm.css');
let m = fs.readFileSync(mp, 'utf8');
m = m.replace('.ic svg{width:21px;height:21px', '.ic svg{width:19px;height:19px');
m = m.replace('.tab svg{width:22px;height:22px', '.tab svg{width:19px;height:19px');
m = m.replace('.searchbar svg{width:17px;height:17px', '.searchbar svg{width:16px;height:16px');
m = m.replace('.ic{width:38px;height:38px', '.ic{width:34px;height:34px');
fs.writeFileSync(mp, m, 'utf8');
console.log('+ m.css 手機圖標縮小（19px）');
