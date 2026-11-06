// 修 --dsh-side-pad 多了一個 px（px() 已經帶單位）
//   node tools/fix-sidepad.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'dsh-tokens.js');
let s = fs.readFileSync(p, 'utf8');
const a = "String(px('sidebar', 'inlinePadding')) + 'px'";
const b = "String(px('sidebar', 'inlinePadding'))";
if (!s.includes(a)) { console.error('❌ 找不到那段'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 修好 pxpx');
