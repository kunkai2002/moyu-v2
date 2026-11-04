// 修正 CSS 特異性：theme.css 的 DSH 規則用 `:root[data-theme="dsh"] .x`（0,3,0），
// polish 層的 `[data-shell="dsh"] .x` 只有 0,2,0 → 被打回去（例：.meta 還是 12px、.step 還是 12.5px）。
// 統一在前面補 `:root`，讓 polish 層以同樣特異性、靠載入順序勝出。
//   node tools/patch-polish-specificity.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
for (const rel of ['ui/dsh-polish.css', 'ui/dsh-polish-2.css']) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  const before = (s.match(/^\[data-shell="dsh"\]/gm) || []).length;
  // 只改「行首」的選擇器，不要動 :root[data-shell="dsh"]{ 這種 token 區塊
  s = s.split('\n').map((line) => {
    if (/^\[data-shell="dsh"\]/.test(line)) return line.replace(/^\[data-shell="dsh"\]/, ':root[data-shell="dsh"]');
    return line;
  }).join('\n');
  fs.writeFileSync(p, s, 'utf8');
  console.log(`${rel}: 改了 ${before} 條選擇器`);
}
