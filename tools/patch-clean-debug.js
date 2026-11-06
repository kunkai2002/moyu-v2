// 收掉除錯輸出（__pd）與早期分支的線索
//   node tools/patch-clean-debug.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;
const lines = s.split('\n').filter((l) => {
  if (l.includes('window.__pd')) { n++; return false; }
  if (l.includes('window.__pd.sets')) { n++; return false; }
  return true;
});
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log(n ? '✅ 移除 ' + n + ' 行除錯輸出' : '沒有除錯輸出');
