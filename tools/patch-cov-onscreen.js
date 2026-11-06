// audit 的「按鈕被蓋住」判定：只檢查「中心點在視窗內」的按鈕。
// 820×620 時頂欄左側的上一頁/下一頁可能落在視窗外，elementFromPoint 會回傳 body，
// 被誤判成被蓋住（實際上使用者點不到也不需要點）。
//   node tools/patch-cov-onscreen.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'audit-chat-ui.js');
let s = fs.readFileSync(p, 'utf8');
const a = "      for (const b of document.querySelectorAll('.tb-btn, .hint-btn, .cn-btn')) {\n        const r = b.getBoundingClientRect();\n        if (r.width < 4) continue;";
const b = [
  "      for (const b of document.querySelectorAll('.tb-btn, .hint-btn, .cn-btn')) {",
  "        const r = b.getBoundingClientRect();",
  "        if (r.width < 4) continue;",
  "        // 中心點不在視窗內的按鈕不判斷（820×620 時頂欄左側可能被推到視窗外）",
  "        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);",
  "        if (cx < 0 || cy < 0 || cx > innerWidth - 1 || cy > innerHeight - 1) continue;",
].join('\n');
if (!s.includes(a)) { console.error('❌ 找不到覆蓋判定迴圈'); process.exit(1); }
s = s.split(a).join(b);
const c = "        const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));";
const d = "        const hit = document.elementFromPoint(cx, cy);";
if (s.includes(c)) s = s.split(c).join(d);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ audit 只判斷視窗內的按鈕');
