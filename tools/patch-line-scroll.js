// Enter 翻頁改成「一行一行往上滑，到半屏停下來」（JOJO 2026-11-06）
//   每次前進約一個行高（24px），每 32ms 一步 → 半屏約 0.4–0.5 秒，像 ds Flash 思考的速度。
//   滑動過程中，剛進入畫面的段落會同步逐行長出來（還沒打過字的才打）。
//   node tools/patch-line-scroll.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('function pageDownHalf() {');
const end = s.indexOf('\n\n', s.indexOf('  typeParagraphs(fresh);', start));
if (start < 0 || end < 0) { console.error('❌ 找不到 pageDownHalf'); process.exit(1); }

const body = [
  'function pageDownHalf() {',
  '  const s = document.querySelector(\'#stream\');',
  '  if (!s) return;',
  '  const view = s.clientHeight;',
  '  const max = Math.max(0, s.scrollHeight - view);',
  '  const from = s.scrollTop;',
  '  if (from >= max - 2) {                       // 到底了：接下一章',
  '    const sent = document.querySelector(\'.flow-more\');',
  '    if (sent) sent.click();',
  '    return;',
  '  }',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  const to = Math.min(max, from + Math.round(view / 2));',
  '  const lp = document.querySelector(\'#stream .p\');',
  '  const lineH = lp ? (parseFloat(getComputedStyle(lp).lineHeight) || 24) : 24;',
  '  const stepPx = Math.max(12, Math.round(lineH));     // 一次往上滑「一行」',
  '  const STEP_MS = 32;                                 // 每 32ms 一行 → 半屏約 0.4 秒',
  '',
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
  '',
  '  if (reduce) { s.scrollTop = to; revealNow(); return; }',
  '  let cur = from;',
  '  const timer = setInterval(() => {',
  '    cur = Math.min(to, cur + stepPx);',
  '    s.scrollTop = cur;',
  '    revealNow();',
  '    if (cur >= to) clearInterval(timer);',
  '  }, STEP_MS);',
  '}',
].join('\n');

s = s.slice(0, start) + body + s.slice(end);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ pageDownHalf 改成「一行一行往上滑，半屏停」');
