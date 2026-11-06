// 徹底移除「側欄覆蓋式抽屜」：側欄永遠在版面流裡（JOJO 要完整側欄；抽屜只給目錄）
//   原因：820 時 .side 被舊的 .side-overlay 規則 display:none，整個版面塌成兩欄。
//   node tools/patch-kill-side-overlay.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let n = 0;

/* ① shell-dsh.js：不再加 side-overlay / 不再動 side-open */
{
  const p = path.join(ROOT, 'ui', 'shell-dsh.js');
  let s = fs.readFileSync(p, 'utf8');
  const a = "    app.classList.toggle('side-overlay', overlaySide && !railWanted);";
  const b = "    // 側欄不做覆蓋式抽屜（820 會把版面壓成兩欄）；它永遠在版面流裡";
  if (s.includes(a)) { s = s.split(a).join(b); n++; }
  const c = "    if (vw >= 900) app.classList.remove('side-open');   // 回到寬螢幕：側欄抽屜要收掉";
  if (s.includes(c)) { s = s.split(c).join('    app.classList.remove(\'side-open\');'); n++; }
  fs.writeFileSync(p, s, 'utf8');
  console.log('· shell-dsh.js：移除 side-overlay');
}

/* ② CSS：把 side-overlay 的隱藏規則改成「永遠顯示」 */
{
  const p = path.join(ROOT, 'ui', 'dsh-polish-3.css');
  let s = fs.readFileSync(p, 'utf8');
  const a = ':root[data-shell="dsh"] .app.side-overlay:not(.side-open) .side{display:none}';
  const b = '/* 側欄永遠顯示（不再用覆蓋式抽屜） */\n:root[data-shell="dsh"] .app .side{display:flex}';
  if (s.includes(a)) { s = s.split(a).join(b); n++; }
  fs.writeFileSync(p, s, 'utf8');
  console.log('· dsh-polish-3.css：side-overlay 隱藏規則改成永遠顯示');
}

console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
