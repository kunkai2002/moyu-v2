// 節奏定案（JOJO 2026-11-06）：按一次 Enter，整段「約 2 秒才顯示完」
//   · 捲動：一行一步，總時長約 2 秒（步距 140ms 左右）
//   · 出字：排隊逐段吐，每次 3–5 字，整體也在約 2 秒內完成
//   node tools/patch-2s.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

/* ① typeParagraphs：共用排程器，總長度約 2 秒 */
const t1 = 'function typeParagraphs(list) {';
const t2 = 'function pageDownHalf() {';
const i1 = s.indexOf(t1);
const i2 = s.indexOf(t2, i1);
if (i1 < 0 || i2 < 0) { console.error('❌ 找不到 typeParagraphs'); process.exit(1); }

const fn = [
  'function typeParagraphs(list) {',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  const queue = (list || []).filter((e) => e && e.node && e.node.dataset.typed !== \'1\');',
  '  if (!queue.length) return;',
  '  queue.forEach((e) => { e.node.dataset.typed = \'1\'; });',
  '  if (reduce) { queue.forEach((e) => { e.node.textContent = e.text; }); return; }',
  '  /* 先把每段的高度鎖住（避免邊打字邊把下面推走），再排隊慢慢吐 */',
  '  queue.forEach((e) => {',
  '    const prev = e.node.textContent;',
  '    e.node.textContent = e.text;',
  '    const h = e.node.scrollHeight;',
  '    e.node.textContent = prev;',
  '    e.node.style.minHeight = h + \'px\';',
  '    e.node.textContent = \'\';',
  '  });',
  '  const per = 4;                                       // 一次 4 個字（3–5 之間）',
  '  const totalTicks = queue.reduce((n, e) => n + Math.ceil(e.text.length / per), 0);',
  '  const DURATION = 2000;                               // JOJO：兩秒才顯示完，不然看不出來',
  '  const interval = Math.max(16, Math.min(160, Math.round(DURATION / Math.max(1, totalTicks))));',
  '  let i = 0;',
  '  let shown = 0;',
  '  const timer = setInterval(() => {',
  '    if (i >= queue.length) { clearInterval(timer); return; }',
  '    const e = queue[i];',
  '    shown = Math.min(e.text.length, shown + per);',
  '    e.node.textContent = e.text.slice(0, shown);',
  '    if (shown >= e.text.length) { e.node.style.minHeight = \'\'; i++; shown = 0; }',
  '  }, interval);',
  '  // 保險：3 秒內一定全部補滿',
  '  setTimeout(() => {',
  '    clearInterval(timer);',
  '    queue.forEach((e) => { if (e.node.textContent !== e.text) { e.node.textContent = e.text; e.node.style.minHeight = \'\'; } });',
  '  }, 3000);',
  '}',
  '',
  '',
].join('\n');
s = s.slice(0, i1) + fn + s.slice(i2);

/* ② pageDownHalf：捲動總時長也對齊 2 秒 */
const a1 = s.indexOf('function pageDownHalf() {');
const a2 = s.indexOf('function streamParagraphs(', a1);
const body = s.slice(a1, a2);
const fixed = body
  .replace(
    '  const stepPx = Math.max(12, Math.round(lineH));',
    '  const stepPx = Math.max(12, Math.round(lineH));\n  const travel = Math.max(1, Math.ceil((to - from) / stepPx));\n  const STEP_MS = Math.max(24, Math.round(2000 / travel));   // 整趟約 2 秒'
  )
  .replace('  }, 32);', '  }, STEP_MS);');
s = s.slice(0, a1) + fixed + s.slice(a2);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ 節奏改成「約 2 秒顯示完」（捲動 + 出字）');
