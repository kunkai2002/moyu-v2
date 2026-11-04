// 修 class 撞名：shell-dsh.js 給 .app 加的修飾 class 從 `rail` 改成 `side-rail`
// （theme.css 第 37 行的 `.rail` 是 VS Code 活動列，`.app.rail` 會讓整個 app display:none）
//   node tools/patch-rail-class.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = {
  'ui/shell-dsh.js': [
    ["app.classList.toggle('rail', rail)", "app.classList.toggle('side-rail', rail)"],
  ],
  'ui/theme.css': [
    ['[data-shell="dsh"] .app.rail ', '[data-shell="dsh"] .app.side-rail '],
  ],
};

let total = 0;
for (const [rel, subs] of Object.entries(files)) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  for (const [a, b] of subs) {
    const n = s.split(a).length - 1;
    if (!n) { console.log(`  ! ${rel} 找不到：${a}`); continue; }
    s = s.split(a).join(b);
    total += n;
    console.log(`  ${rel}: ${a} → ${b}（${n} 處）`);
  }
  // shell-dsh.js 裡的其他 rail 判斷（變數名不用改，只改 class 字串）
  if (rel.endsWith('shell-dsh.js')) {
    s = s.replace(/classList\.toggle\('rail'/g, "classList.toggle('side-rail'");
  }
  if (s !== before) fs.writeFileSync(p, s, 'utf8');
}
console.log('✅ 共改 ' + total + ' 處');
