// 修 test-pagedown 的期望值：接近底部時「半屏」會被 max 夾住，期望值要一樣算
//   node tools/patch-test-expect.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-pagedown.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

const a = "  const want = Math.round(before.view / 2);";
const b = "  const maxScroll = Math.max(0, before.ih - before.view);\n  const want = Math.min(Math.round(before.view / 2), Math.max(0, maxScroll - before.top));";
if (s.includes(a)) { s = s.split(a).join(b); n++; } else console.log('  ! 找不到 want 那行');

const a2 = "    return { top: Math.round(s.scrollTop), view: s.clientHeight, ih: s.scrollHeight };";
if (s.includes(a2)) { console.log('  · before 已含 ih'); } else console.log('  ! before 沒有 ih');

fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 期望值改成「半屏或剩餘可捲距離，取小的」' : '沒有需要改的');
