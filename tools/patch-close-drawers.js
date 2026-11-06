// ① layoutPass：寬度回到 ≥900 時把側欄抽屜關掉（避免殘留 side-open 蓋住頂欄按鈕）
// ② audit 的每尺寸清理也收掉 side-open
//   node tools/patch-close-drawers.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

{
  const p = path.join(ROOT, 'ui', 'shell-dsh.js');
  let s = fs.readFileSync(p, 'utf8');
  const a = "    if (vw >= 1100) app.classList.remove('toc-open');";
  const b = "    if (vw >= 1100) app.classList.remove('toc-open');\n    if (vw >= 900) app.classList.remove('side-open');   // 回到寬螢幕：側欄抽屜要收掉";
  if (s.includes(a)) { s = s.split(a).join(b); fs.writeFileSync(p, s, 'utf8'); console.log('· shell-dsh.js：寬螢幕自動收側欄抽屜'); }
  else console.log('  ! shell-dsh.js 找不到 toc-open 那行');
}

{
  const p = path.join(ROOT, 'tools', 'audit-chat-ui.js');
  let s = fs.readFileSync(p, 'utf8');
  const a = "      document.querySelector('.app')?.classList.remove('toc-open');";
  const b = "      document.querySelector('.app')?.classList.remove('toc-open');\n      document.querySelector('.app')?.classList.remove('side-open');";
  if (s.includes(a)) { s = s.split(a).join(b); fs.writeFileSync(p, s, 'utf8'); console.log('· audit：每尺寸清理也收 side-open'); }
  else console.log('  ! audit 找不到清理那行');
}
