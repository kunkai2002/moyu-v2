// 「整體出現時間 2 秒」：不是每段 2 秒，而是整批（翻頁後新出現的所有段落）在 2 秒內吐完。
//   做法：每次翻頁記一個 deadline＝now+2000；排程器每 tick 依剩餘字數/剩餘時間動態算一次吐幾個字。
//   node tools/patch-global-2s.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const t1 = s.indexOf('/* ── 逐段出字：單一排程器、嚴格排隊');
const t2 = s.indexOf('function pageDownHalf() {', t1);
if (t1 < 0 || t2 < 0) { console.error('❌ 找不到出字排程器區塊'); process.exit(1); }

const block = [
  '/* ── 逐段出字：單一排程器、嚴格排隊、整批 2 秒內完成 ────────────',
  '   · 一次只吐一段；這一段吐完才換下一段（不能兩段同時長）',
  '   · 「2 秒」是**整批**的時間：從按下 Enter 起算，所有新出現的段落在 2 秒內吐完',
  '     （JOJO 2026-11-06：「整體出現的時間是兩秒鐘，不是一段」）',
  '   · 每 tick 依「剩餘字數 ÷ 剩餘時間」動態決定這次吐幾個字，所以段落多也不會超過 2 秒 */',
  'const __typeQueue = [];',
  'let __typeTimer = null;',
  'let __typeCurrent = null;',
  'let __typeDeadline = 0;',
  'const __TYPE_BUDGET = 2000;                       // 整批 2 秒',
  '',
  'function __typeRemaining() {',
  '  let n = __typeCurrent ? (__typeCurrent.text.length - (__typeCurrent.node.textContent || \'\').length) : 0;',
  '  for (const e of __typeQueue) n += e.text.length;',
  '  return n;',
  '}',
  '',
  'function __typeNext() {',
  '  if (__typeTimer || __typeCurrent) return;',
  '  while (__typeQueue.length) {',
  '    const e = __typeQueue.shift();',
  '    if (!e || !e.node || !e.node.isConnected) continue;',
  '    __typeCurrent = e;',
  '    break;',
  '  }',
  '  const e = __typeCurrent;',
  '  if (!e) return;',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  if (reduce) { e.node.textContent = e.text; e.node.style.minHeight = \'\'; __typeCurrent = null; __typeNext(); return; }',
  '  let shown = 0;',
  '  const TICK = 16;',
  '  __typeTimer = setInterval(() => {',
  '    const left = Math.max(1, __typeDeadline - Date.now());',
  '    const ticks = Math.max(1, left / TICK);',
  '    const remain = __typeRemaining();',
  '    const per = Math.max(2, Math.ceil(remain / ticks));      // 動態：趕得上 2 秒',
  '    shown = Math.min(e.text.length, shown + per);',
  '    e.node.textContent = e.text.slice(0, shown);',
  '    if (shown >= e.text.length) {',
  '      clearInterval(__typeTimer);',
  '      __typeTimer = null;',
  '      e.node.textContent = e.text;',
  '      e.node.style.minHeight = \'\';',
  '      __typeCurrent = null;',
  '      __typeNext();                                          // 這一段完了才換下一段',
  '    }',
  '  }, TICK);',
  '  setTimeout(() => {                                          // 保險',
  '    if (__typeCurrent === e && e.node.textContent !== e.text) {',
  '      clearInterval(__typeTimer); __typeTimer = null;',
  '      e.node.textContent = e.text; e.node.style.minHeight = \'\';',
  '      __typeCurrent = null; __typeNext();',
  '    }',
  '  }, Math.max(400, __typeDeadline - Date.now() + 200));',
  '}',
  '',
  'function typeParagraphs(list) {',
  '  const fresh = (list || []).filter((e) => e && e.node && e.node.isConnected && e.node.dataset.typed !== \'1\');',
  '  if (!fresh.length) return;',
  '  fresh.forEach((e) => {',
  '    e.node.dataset.typed = \'1\';',
  '    const prev = e.node.textContent;',
  '    e.node.textContent = e.text;                              // 量完整高度，先鎖住避免版面跳動',
  '    const h = e.node.scrollHeight;',
  '    e.node.style.minHeight = h + \'px\';',
  '    e.node.textContent = prev;',
  '    e.node.textContent = \'\';',
  '    __typeQueue.push(e);',
  '  });',
  '  __typeQueue.sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));',
  '  __typeDeadline = Date.now() + __TYPE_BUDGET;                 // 每次翻頁重新計時：整批 2 秒',
  '  __typeNext();',
  '}',
  '',
  '',
].join('\n');

s = s.slice(0, t1) + block + s.slice(t2);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 出字改成「整批 2 秒內完成」（動態字數）');
