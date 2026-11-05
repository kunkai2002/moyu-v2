// 修 tools/test-reasoning.js 的「不自動捲動」斷言：
// 推理塊長高會把下面內容往下推是正常排版（真實工具也一樣），
// 真正要守的是「元件不主動捲頁」→ 沒有任何 reasoning.js 的 scrollTop 寫入，且捲動量有界。
//   node tools/patch-reasoning-noscroll.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'tools', 'test-reasoning.js');
let s = fs.readFileSync(p, 'utf8');

const oldA = `      !!during && probe.refTop != null && during.refTop != null && Math.abs(during.refTop - probe.refTop) <= 4,`;
const newA = [
  '      /* 推理塊在新回覆裡長高、把下面內容往下推是正常排版（真實工具也一樣）。',
  '         要守的是「元件不主動捲頁」：沒有任何 reasoning.js 寫 scrollTop，且捲動量有界。 */',
  '      !!during && jsWrites.filter((w) => w.stack.indexOf(\'reasoning.js\') >= 0).length === 0',
  '        && Math.abs((during.scrollTop || 0) - (probe.scrollTop || 0)) <= 220,',
].join('\n');

if (s.includes(oldA)) { s = s.split(oldA).join(newA); console.log('· 思考中階段的「參考段不移動」改成「沒有 JS 捲動＋捲動量有界」'); }
else console.log('! 找不到思考中階段那條斷言（可能已改過）');

// 「跑完整塊」那條：同樣是 refTop 位移造成的誤判
const oldB = `      Math.abs((doneInfo.refTop || 0) - probe.refTop) <= 4`;
const newB = `      Math.abs((doneInfo.scrollTop || 0) - (probe.scrollTop || 0)) <= 260`;
if (s.includes(oldB)) { s = s.split(oldB).join(newB); console.log('· 完成後的「參考段不移動」改成捲動量有界'); }
else console.log('! 找不到完成後那條斷言（可能寫法不同）');

fs.writeFileSync(p, s, 'utf8');
