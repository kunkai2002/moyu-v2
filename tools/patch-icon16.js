// 收掉新輸入列的視覺閘門違規：hint-btn 的 svg 15px → 16px（尺度只准 12/14/16/18/20）
//   node tools/patch-icon16.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const fixes = [
  ['ui/dsh-polish.css', ':root[data-shell="dsh"] .composer .hint-btn svg{width:15px;height:15px}', ':root[data-shell="dsh"] .composer .hint-btn svg{width:16px;height:16px}'],
];
let n = 0;
for (const [rel, a, b] of fixes) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes(a)) { s = s.split(a).join(b); fs.writeFileSync(p, s, 'utf8'); n++; console.log('· ' + rel + '：' + a.slice(-30) + ' → 16px'); }
  else console.log('  ! ' + rel + ' 找不到（可能已改）');
}
console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
