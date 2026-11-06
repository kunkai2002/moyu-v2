// 修：taste.css 把 #sbChapter 設成 var(--fg)，在 word/excel/vscode 的有色狀態列上對比不足
//     改成 a11y 層算好的 --a11y-status-strong（那組是針對每個主題的狀態列底色算的）
//   node tools/fix-sbchapter.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'taste.css');
let s = fs.readFileSync(p, 'utf8');
const a = ':root[data-shell="dsh"] .statusbar #sbChapter{color:var(--fg);font-weight:500}';
const b = ':root[data-shell="dsh"] .statusbar #sbChapter{color:var(--a11y-status-strong, var(--fg));font-weight:500}';
if (!s.includes(a)) { console.error('❌ 找不到 #sbChapter 那行'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ #sbChapter 改用 --a11y-status-strong');
