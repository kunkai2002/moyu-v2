// 讓「整批出字」剛好落在 1.5 秒（加上 0.5 秒翻頁滑動 ≈ 整體 2 秒）：
//   每次固定吐 3–4 個字；間隔 = 預算 ÷ 需要的次數（而不是靠動態字數硬趕）
//   node tools/patch-fixed-pace.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const a = s.slice(s.indexOf('  const total = queue.reduce((n, e) => n + e.text.length, 0);'), s.indexOf('  setTimeout(finishAll, Math.max(800, budgetMs || 1500) + 1200);'));
const b = [
  '  const total = queue.reduce((n, e) => n + e.text.length, 0);',
  '  const per = total > 600 ? 4 : 3;                       // 一次 3–4 個字（JOJO：幾個字幾個字一起）',
  '  const ticks = Math.max(1, Math.ceil(total / per));',
  '  const budget = Math.max(400, budgetMs || 1500);',
  '  const TICK = Math.max(16, Math.min(160, Math.round(budget / ticks)));   // 讓整批剛好落在預算內',
  '  let i = 0;',
  '  let shown = 0;',
  '  let timer = null;',
  '  const finishAll = () => {',
  '    if (timer) clearInterval(timer);',
  '    timer = null;',
  '    queue.forEach((e) => { if (e.node.textContent !== e.text) e.node.textContent = e.text; e.node.style.minHeight = \'\'; });',
  '  };',
  '  timer = setInterval(() => {',
  '    if (i >= queue.length) { finishAll(); return; }',
  '    const e = queue[i];',
  '    shown = Math.min(e.text.length, shown + per);',
  '    e.node.textContent = e.text.slice(0, shown);',
  '    if (shown >= e.text.length) {',
  '      e.node.textContent = e.text;',
  '      e.node.style.minHeight = \'\';',
  '      i++; shown = 0;                                     // 這一段打完才換下一段',
  '    }',
  '  }, TICK);',
  '',
].join('\n');
if (!a) { console.error('❌ 找不到 typeBatch 主體'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 出字改成固定 3–4 字/次、間隔依預算分配');
