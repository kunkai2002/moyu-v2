// 在「沒有段落可打」的早期分支留下線索，方便確認是選取條件問題還是全部已標記
//   node tools/patch-pd-empty-debug.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
const a = "  if (!list.length || reduce) {";
const b = "  if (!list.length) { window.__pd = { empty: true, pCount: document.querySelectorAll('#stream .p').length, typedCount: document.querySelectorAll('#stream .p[data-typed=\"1\"]').length, srTop: Math.round(sr.top), srBottom: Math.round(sr.bottom), scrollTop: Math.round(from) }; }\n  if (!list.length || reduce) {";
if (!s.includes(a)) { console.error('❌ 找不到早期分支'); process.exit(1); }
s = s.replace(a, b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 早期分支留下 __pd 線索');
