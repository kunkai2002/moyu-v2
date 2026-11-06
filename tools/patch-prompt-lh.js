// prompt「>」的行高 36px 不在尺度內 → 改成 28px ＋ 用 flex 對齊置中
//   node tools/patch-prompt-lh.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'dsh-polish.css');
let s = fs.readFileSync(p, 'utf8');
const a = ':root[data-shell="dsh"] .composer .box-line .prompt{\n  line-height:36px;font-size:13px;color:var(--p-fg-muted);\n}';
const b = ':root[data-shell="dsh"] .composer .box-line .prompt{\n  line-height:28px;font-size:13px;color:var(--p-fg-muted);\n  align-self:center;\n}';
if (!s.includes(a)) { console.error('❌ 找不到 prompt 規則'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ prompt 行高 36 → 28');
