// 收尾：出字保險時間縮短（budget + 400ms），並確認 min-height 一定會釋放
//   node tools/patch-safety.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
const a = "  setTimeout(finishAll, Math.max(800, budgetMs || 1500) + 1200);    // 保險";
const b = "  setTimeout(finishAll, Math.max(600, budgetMs || 1500) + 400);      // 保險：預算 +0.4s 一定收乾淨";
if (!s.includes(a)) { console.error('❌ 找不到保險那一行'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 保險時間 budget+400ms');
