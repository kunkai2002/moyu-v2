// 診斷：把 pageDownHalf 的內部數字寫到 window.__pd，方便一次看清楚為什麼 scrollTop 沒動
//   node tools/patch-pd-debug.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

const a = "  let i = 0;\n  let shown = 0;\n  let moved = 0;\n  let timer = null;";
const b = "  let i = 0;\n  let shown = 0;\n  let moved = 0;\n  let timer = null;\n  window.__pd = { from, to: Math.min(max, from + budget), budget, max, total, ticks, tick: TICK, list: list.length, sets: [] };";
if (s.includes(a)) { s = s.split(a).join(b); n++; } else console.log('  ! 找不到狀態變數');

const c = "    s.scrollTop = Math.min(max, from + moved);";
const d = "    s.scrollTop = Math.min(max, from + moved);\n    if (window.__pd) { window.__pd.moved = Math.round(moved); window.__pd.sets.push(Math.round(s.scrollTop)); }";
if (s.includes(c)) { s = s.split(c).join(d); n++; } else console.log('  ! 找不到 scrollTop 寫入');

fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 加了除錯輸出（' + n + ' 處）' : '沒有需要改的');
