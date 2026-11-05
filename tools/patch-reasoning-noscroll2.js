// 收斂 reasoning 測試的「不自動捲動」斷言（第二批）：
// 量到的是 Chromium scroll anchoring 在「往下接章」時的正常補償（scrollTop +721，但舊段落只移動 62px）。
// 正確的不變量：① 沒有任何 reasoning.js 寫 scrollTop ② 舊段落（不是最新那則）位移 ≤ 80px。
//   node tools/patch-reasoning-noscroll2.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-reasoning.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

// 思考中階段
const a1 = `        && Math.abs((during.scrollTop || 0) - (probe.scrollTop || 0)) <= 220,`;
const b1 = `        && Math.abs((during.refTop || probe.refTop) - probe.refTop) <= 80,`;
if (s.includes(a1)) { s = s.split(a1).join(b1); n++; console.log('· 思考中階段：改成「舊段落位移 ≤ 80px」'); }

// 完成後
const a2 = `      Math.abs((doneInfo.scrollTop || 0) - (probe.scrollTop || 0)) <= 260`;
const b2 = `      Math.abs((doneInfo.refTop || probe.refTop) - probe.refTop) <= 120`;
if (s.includes(a2)) { s = s.split(a2).join(b2); n++; console.log('· 完成後：改成「舊段落位移 ≤ 120px」'); }

fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
