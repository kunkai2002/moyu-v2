// 簡化：側欄永遠在版面流裡（不再做成覆蓋式抽屜）。
//   JOJO 要的是「完整的可展開側邊欄」；覆蓋式抽屜在 820 會蓋住頂欄按鈕（驗收一直紅），
//   而且他根本不想看到沒有文字的圖示軌。只有「目錄」才是抽屜。
//   node tools/patch-sidebar-inflow.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'shell-dsh.js');
let s = fs.readFileSync(p, 'utf8');
const a = "    var overlaySide = vw < 900;                          // <900：側欄是抽屜（一樣有文字）";
const b = "    var overlaySide = false;                             // 側欄永遠在版面流裡（JOJO 要完整側欄；抽屜只給目錄）";
if (!s.includes(a)) { console.error('❌ 找不到 overlaySide'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 側欄改成一直在版面流裡');
