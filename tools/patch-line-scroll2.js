// 最終版：Enter = 一行一行往上滑（每步一個行高、32ms），到半屏停；
//          同一時間，剛進畫面的段落用「幾個字幾個字」的方式長出來（每 tick 3–5 字，很快）
//   node tools/patch-line-scroll2.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

/* ① pageDownHalf：整段換掉（用 marker 切片，不吃換行符差異） */
const m1 = 'function pageDownHalf() {';
const m2 = 'function streamParagraphs(';
const i1 = s.indexOf(m1);
const i2 = s.indexOf(m2, i1);
if (i1 < 0 || i2 < 0) { console.error('❌ 找不到 pageDownHalf 區塊'); process.exit(1); }

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
  '  function revealNow() {',
  '    const sr = s.getBoundingClientRect();',
  '    const fresh = [];',
  '    document.querySelectorAll(\'#stream .p\').forEach((p) => {',
  '      if (p.dataset.typed === \'1\') return;',
  '      const r = p.getBoundingClientRect();',
  '      if (r.bottom > sr.top && r.top < sr.bottom) fresh.push({ node: p, text: p.textContent });',
  '    });',
  '    typeParagraphs(fresh);',
  '  }',
  '  if (reduce) { s.scrollTop = to; revealNow(); return; }',
  '  /* 一行一行往上滑：每步大約一個行高，32ms 一步 → 半屏約 0.4–0.5 秒（像 ds Flash 思考速度） */',
  '  const lp = document.querySelector(\'#stream .p\');',
  '  const lineH = lp ? (parseFloat(getComputedStyle(lp).lineHeight) || 24) : 24;',
  '  const stepPx = Math.max(12, Math.round(lineH));',
  '  let cur = from;',
  '  const timer = setInterval(() => {',
  '    cur = Math.min(to, cur + stepPx);',
  '    s.scrollTop = cur;',
  '    revealNow();',
  '    if (cur >= to) clearInterval(timer);',
  '  }, 32);',
  '}',
  '',
  '',
].join('\n');
s = s.slice(0, i1) + fn + s.slice(i2);

/* ② typeOne：一次吐「幾個字」（3–5 字），很快；高亮行仍在原位不動 */
const t1 = 'function typeOne(node, text, done) {';
const t2 = 'function typeParagraphs(list) {';
const j1 = s.indexOf(t1);
const j2 = s.indexOf(t2, j1);
if (j1 < 0 || j2 < 0) { console.error('❌ 找不到 typeOne 區塊'); process.exit(1); }

const typefn = [
  'function typeOne(node, text, done) {',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  if (reduce) { node.textContent = text; if (done) done(); return; }',
  '  /* 一次吐「幾個字」（3–5 字，隨段落長度微調），每 28ms 一次：',
  '     看起來就是一行一行在長、而且一行裡面是幾個字幾個字一起出現（JOJO 2026-11-06）。 */',
  '  const fullH = (() => { const prev = node.textContent; node.textContent = text; const h = node.scrollHeight; node.textContent = prev; return h; })();',
  '  node.style.minHeight = fullH + \'px\';',
  '  node.textContent = \'\';',
  '  const per = text.length > 600 ? 5 : (text.length > 300 ? 4 : 3);',
  '  let shown = 0;',
  '  const finish = () => { node.textContent = text; node.style.minHeight = \'\'; if (done) done(); };',
  '  const tick = () => {',
  '    shown = Math.min(text.length, shown + per);',
  '    node.textContent = text.slice(0, shown);',
  '    if (shown >= text.length) { finish(); return; }',
  '    setTimeout(tick, 28);',
  '  };',
  '  setTimeout(tick, 12);',
  '  setTimeout(() => { if (node.textContent !== text) finish(); }, 1500);',
  '}',
  '',
].join('\n');
s = s.slice(0, j1) + typefn + s.slice(j2);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ pageDownHalf＝一行一行往上滑；typeOne＝每次 3–5 字');
