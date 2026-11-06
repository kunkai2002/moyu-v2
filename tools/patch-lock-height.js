// 修：出字時段落先被清空 → 內容高度瞬間變矮 → 瀏覽器把 scrollTop 夾回去（實測 -105px）
// 解法：清空前先把每段 min-height 鎖在原本高度，捲動就不會被夾；結束再釋放。
//   node tools/patch-lock-height.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const a = [
  "      p.dataset.full = p.textContent;",
  "      p.dataset.typed = '1';",
  "      p.textContent = '';",
  "      list.push(p);",
].join('\n');
const b = [
  "      p.dataset.full = p.textContent;",
  "      p.dataset.typed = '1';",
  "      const h = p.scrollHeight;              // 先量完整高度，鎖住避免捲動被夾",
  "      if (h > 0) p.style.minHeight = h + 'px';",
  "      p.textContent = '';",
  "      list.push(p);",
].join('\n');
if (!s.includes(a)) { console.error('❌ 找不到收集段落的區塊'); process.exit(1); }
s = s.split(a).join(b);

const c = "    list.forEach((p) => { p.textContent = p.dataset.full; delete p.dataset.full; });";
const d = "    list.forEach((p) => { p.textContent = p.dataset.full; delete p.dataset.full; p.style.minHeight = ''; });";
s = s.split(c).join(d);

const e = "    list.forEach((p) => { if (p.dataset.full != null) { p.textContent = p.dataset.full; delete p.dataset.full; } });";
const f = "    list.forEach((p) => { if (p.dataset.full != null) { p.textContent = p.dataset.full; delete p.dataset.full; } p.style.minHeight = ''; });";
s = s.split(e).join(f);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ 出字前鎖住段落高度（scrollTop 不會被夾）');
