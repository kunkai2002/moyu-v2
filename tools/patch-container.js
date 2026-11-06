// 修：抽屜需要 .app 是定位容器（1024 會多出 323px 橫向溢出）
// 另外 layout-gate 的「900×800 收合軌 56」要改成新策略：不再自動縮軌，280 或使用者手動 56 都算對
//   node tools/patch-container-and-gate.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let n = 0;

/* ① .app position:relative（不分尺寸） */
{
  const p = path.join(ROOT, 'ui', 'dsh-polish-3.css');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes(':root[data-shell="dsh"] .app{position:relative}')) {
    s += '\n/* 抽屜（側欄／目錄）需要 .app 當定位容器，否則會逃出 overflow 造成橫向捲動 */\n:root[data-shell="dsh"] .app{position:relative}\n';
    fs.writeFileSync(p, s, 'utf8');
    n++; console.log('· dsh-polish-3.css：.app position:relative');
  }
}

/* ② layout-gate：收合軌那條改成「完整側欄或手動收合」 */
{
  const p = path.join(ROOT, 'tools', 'layout-gate.js');
  let s = fs.readFileSync(p, 'utf8');
  const a = "收合軌寬";
  if (s.includes(a)) {
    console.log('  · layout-gate 內有「收合軌寬」字樣，請人工確認（這支腳本由 gate 維護）');
  }
}

console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
