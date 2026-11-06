// 修正：整批 2 秒的「預算」只在批次開始時設定，中途加入的段落不再重新計時，
// 否則翻頁動畫每 40ms 丟新段落進來，每一段都把 deadline 往後推 → 實際拖到 4 秒。
//   node tools/patch-batch-budget.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
const a = "  __typeDeadline = Date.now() + __TYPE_BUDGET;                 // 每次翻頁重新計時：整批 2 秒\n  __typeNext();";
const b = "  /* 預算只在「批次開始」時設定：翻頁動畫會持續把新段落丟進來，\n     如果每丟一次都重設 deadline，實際會拖到 4 秒（JOJO 要的是整體 2 秒）。 */\n  if (!__typeCurrent && !__typeTimer) __typeDeadline = Date.now() + __TYPE_BUDGET;\n  __typeNext();";
if (!s.includes(a)) { console.error('❌ 找不到 deadline 設定'); process.exit(1); }
s = s.split(a).join(b);
// 佇列清空的瞬間也不要殘留舊 deadline（下次翻頁會重新設定）
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 2 秒預算改成「批次開始才設定」');
