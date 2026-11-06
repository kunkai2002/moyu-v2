// 翻頁動畫改成「時間基準 + 絕對位置」：每 tick 用經過時間算出應該停在第幾行，
// 直接寫 scrollTop（不受瀏覽器 scroll anchoring 或逐段打字造成的位移影響），
// 並且是一行一行跳，整趟約 2 秒。
//   node tools/patch-scroll-absolute.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
const a1 = s.indexOf('function pageDownHalf() {');
const a2 = s.indexOf('function streamParagraphs(', a1);
if (a1 < 0 || a2 < 0) { console.error('❌ 找不到 pageDownHalf'); process.exit(1); }

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
  '  /* 一行一行往上滑、整趟約 2 秒（JOJO：兩秒才顯示完，不然看不出來）。',
  '     每一 tick 用「經過時間」重算應該在第幾行、直接寫絕對位置：',
  '     逐段打字會讓內容高度變動，瀏覽器的 scroll anchoring 會偷改 scrollTop，',
  '     用相對累加會被吃掉（實測只走了 5 行就停），所以一定要寫絕對值。 */',
  '  const lp = document.querySelector(\'#stream .p\');',
  '  const lineH = lp ? (parseFloat(getComputedStyle(lp).lineHeight) || 24) : 24;',
  '  const stepPx = Math.max(12, Math.round(lineH));',
  '  const lines = Math.max(1, Math.round((to - from) / stepPx));',
  '  const DURATION = 2000;',
  '  const t0 = Date.now();',
  '  const timer = setInterval(() => {',
  '    const k = Math.min(1, (Date.now() - t0) / DURATION);',
  '    const lineNow = Math.round(k * lines);',
  '    s.scrollTop = Math.min(to, from + lineNow * stepPx);',
  '    revealNow();',
  '    if (k >= 1) { s.scrollTop = to; clearInterval(timer); }',
  '  }, 40);',
  '}',
  '',
  '',
].join('\n');
s = s.slice(0, a1) + fn + s.slice(a2);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 翻頁＝時間基準、絕對位置、一行一行、2 秒');
