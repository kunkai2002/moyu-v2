// 架構收斂（最終版）：
//   Enter → ① 先「一行一行」往上滑到半屏（約 0.5 秒）
//           ② 滑完再對「這半屏新出現的段落」依序出字：一段打完才換下一段，
//              整批（含滑動）約 2 秒
//   這樣打字與滑動不交錯，不會出現「兩段同時長」或「最後一段永遠是空的」。
//   node tools/patch-final-reveal.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const a1 = s.indexOf('/* ── 逐段出字：單一排程器、嚴格排隊、整批 2 秒內完成');
const a2 = s.indexOf('function pageDownHalf() {', a1);
if (a1 < 0 || a2 < 0) { console.error('❌ 找不到出字區塊'); process.exit(1); }

const typing = [
  '/* ── 逐段出字（最終版）───────────────────────────────────────',
  '   typeBatch(list, budgetMs)：把這批段落「一段打完才換下一段」吐完，整批約 budgetMs。',
  '   · 一次只有一段在長（JOJO：不能上一段還沒完下一段就開始）',
  '   · 一次吐 3–5 個字，每 tick 依「剩餘字數 ÷ 剩餘時間」動態調整，整批趕在時間內完成',
  '   · 每段先鎖住高度，避免邊長邊把下面推走 */',
  'function typeBatch(list, budgetMs) {',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  const queue = (list || []).filter((e) => e && e.node && e.node.isConnected && e.node.dataset.typed !== \'1\');',
  '  if (!queue.length) return;',
  '  queue.forEach((e) => {',
  '    e.node.dataset.typed = \'1\';',
  '    const prev = e.node.textContent;',
  '    e.node.textContent = e.text;',
  '    const h = e.node.scrollHeight;',
  '    e.node.style.minHeight = h + \'px\';',
  '    e.node.textContent = prev;',
  '    e.node.textContent = \'\';',
  '  });',
  '  if (reduce) { queue.forEach((e) => { e.node.textContent = e.text; e.node.style.minHeight = \'\'; }); return; }',
  '  const total = queue.reduce((n, e) => n + e.text.length, 0);',
  '  const deadline = Date.now() + Math.max(400, budgetMs || 1500);',
  '  const TICK = 16;',
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
  '    let remaining = (e.text.length - shown);',
  '    for (let k = i + 1; k < queue.length; k++) remaining += queue[k].text.length;',
  '    const ticks = Math.max(1, (deadline - Date.now()) / TICK);',
  '    const per = Math.max(3, Math.min(6, Math.ceil(remaining / ticks)));   // 一次 3–6 個字',
  '    shown = Math.min(e.text.length, shown + per);',
  '    e.node.textContent = e.text.slice(0, shown);',
  '    if (shown >= e.text.length) {',
  '      e.node.textContent = e.text;',
  '      e.node.style.minHeight = \'\';',
  '      i++; shown = 0;                               // 這一段打完才換下一段',
  '    }',
  '  }, TICK);',
  '  setTimeout(finishAll, Math.max(800, budgetMs || 1500) + 1200);    // 保險',
  '}',
  '',
  'function typeParagraphs(list) { typeBatch(list, 1500); }   // 舊介面保留',
  '',
  '',
].join('\n');
s = s.slice(0, a1) + typing + s.slice(a2);

/* pageDownHalf：先滑完（0.5 秒、一行一步）→ 再出字（1.5 秒預算） */
const b1 = s.indexOf('function pageDownHalf() {');
const b2 = s.indexOf('function streamParagraphs(', b1);
const fn = [
  'function pageDownHalf() {',
  '  const s = document.querySelector(\'#stream\');',
  '  if (!s) return;',
  '  const view = s.clientHeight;',
  '  const max = Math.max(0, s.scrollHeight - view);',
  '  const from = s.scrollTop;',
  '  if (from >= max - 2) {                        // 已經到底：接下一章',
  '    const sent = document.querySelector(\'.flow-more\');',
  '    if (sent) sent.click();',
  '    return;',
  '  }',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  const to = Math.min(max, from + Math.round(view / 2));',
  '',
  '  const collect = () => {',
  '    const sr = s.getBoundingClientRect();',
  '    const fresh = [];',
  '    document.querySelectorAll(\'#stream .p\').forEach((p) => {',
  '      if (p.dataset.typed === \'1\') return;',
  '      const r = p.getBoundingClientRect();',
  '      // 取「這一頁新露出來」的段落（畫面上緣往下、到視窗底）',
  '      if (r.bottom > sr.top && r.top < sr.bottom) fresh.push({ node: p, text: p.textContent });',
  '    });',
  '    return fresh;',
  '  };',
  '',
  '  if (reduce) { s.scrollTop = to; typeBatch(collect(), 1500); return; }',
  '',
  '  /* ① 一行一行往上滑（每步一個行高，總長約 0.5 秒） */',
  '  const lp = document.querySelector(\'#stream .p\');',
  '  const lineH = lp ? (parseFloat(getComputedStyle(lp).lineHeight) || 24) : 24;',
  '  const stepPx = Math.max(12, Math.round(lineH));',
  '  const lines = Math.max(1, Math.round((to - from) / stepPx));',
  '  const SCROLL_MS = 500;',
  '  const t0 = Date.now();',
  '  const timer = setInterval(() => {',
  '    const k = Math.min(1, (Date.now() - t0) / SCROLL_MS);',
  '    s.scrollTop = Math.min(to, from + Math.round(k * lines) * stepPx);',
  '    if (k >= 1) {',
  '      s.scrollTop = to;',
  '      clearInterval(timer);',
  '      typeBatch(collect(), 1500);               // ② 滑完才出字：整批約 1.5 秒',
  '    }',
  '  }, 24);',
  '}',
  '',
  '',
].join('\n');
s = s.slice(0, b1) + fn + s.slice(b2);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ 翻頁＝先滑半屏(0.5s) → 再逐段出字(1.5s)');
