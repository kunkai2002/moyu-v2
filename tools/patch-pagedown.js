// 「Enter 往下翻半屏 ＋ 新出現那半屏逐字出字」＋ 送出改成 Alt+Enter
// 同時把原本「自動接章整章打字／IntersectionObserver」的邏輯收掉（改成由翻頁觸發）
//   node tools/patch-pagedown.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

/* ① 用 typeOne / typeParagraphs / pageDownHalf 取代 primeFastType 整段 */
const start = s.indexOf('/* 「快速出字」');
const end = s.indexOf('function streamParagraphs(');
if (start < 0 || end < 0) { console.error('❌ 找不到 primeFastType 區塊'); process.exit(1); }

const block = [
  '/* ══ 翻頁式閱讀（JOJO 2026-11-06）═══════════════════════════════',
  '   Enter（或右下角 ⏎）＝往下翻半屏；剛露出來的那半屏文字快速逐字長出來。',
  '   · 只打「這次新出現、而且還沒打過」的段落（dataset.typed 記住），不會重打',
  '   · 打字前先把段落 min-height 鎖在原本高度，避免文字變長時版面抖動',
  '   · reduced-motion / 慢讀模式：直接顯示，不逐字',
  '   · 已經到底時再按 Enter＝接下一章（走既有的 .flow-more 哨兵） */',
  'function typeOne(node, text, done) {',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  const h = node.offsetHeight;',
  '  if (h > 0) node.style.minHeight = h + \'px\';',
  '  const finish = () => { node.textContent = text; node.style.minHeight = \'\'; if (done) done(); };',
  '  if (reduce) { finish(); return; }',
  '  node.textContent = \'\';',
  '  const DURATION = Math.min(280, Math.max(120, text.length * 3));',
  '  const t0 = Date.now();',
  '  const step = () => {',
  '    const k = Math.min(1, (Date.now() - t0) / DURATION);',
  '    const len = k >= 1 ? text.length : Math.max(1, Math.floor(text.length * k));',
  '    node.textContent = text.slice(0, len);',
  '    if (k >= 1) { node.style.minHeight = \'\'; if (done) done(); return; }',
  '    setTimeout(step, 16);',
  '  };',
  '  setTimeout(step, 16);',
  '  // 保險：1 秒內一定補滿（隱藏視窗節流也不會留空白）',
  '  setTimeout(() => { if (node.textContent !== text) { node.textContent = text; node.style.minHeight = \'\'; } }, 1000);',
  '}',
  '',
  'function typeParagraphs(list) {',
  '  (list || []).forEach(({ node, text }, i) => {',
  '    if (!node || node.dataset.typed === \'1\') return;',
  '    node.dataset.typed = \'1\';',
  '    setTimeout(() => typeOne(node, text), Math.min(120, i * 30));',
  '  });',
  '}',
  '',
  'function pageDownHalf() {',
  '  const s = document.querySelector(\'#stream\');',
  '  if (!s) return;',
  '  const view = s.clientHeight;',
  '  const max = Math.max(0, s.scrollHeight - view);',
  '  const before = s.scrollTop;',
  '  if (before >= max - 2) {                       // 到底了：接下一章',
  '    const sent = document.querySelector(\'.flow-more\');',
  '    if (sent) sent.click();',
  '    return;',
  '  }',
  '  const target = Math.min(max, before + Math.round(view / 2));',
  '  s.scrollTop = target;',
  '  const sr = s.getBoundingClientRect();',
  '  const oldBottom = before + view;               // 舊視窗底（內容座標）',
  '  const newBottom = target + view;',
  '  const fresh = [];',
  '  document.querySelectorAll(\'#stream .p\').forEach((p) => {',
  '    if (p.dataset.typed === \'1\') return;',
  '    const contentTop = p.getBoundingClientRect().top - sr.top + s.scrollTop;',
  '    if (contentTop >= oldBottom - 24 && contentTop < newBottom + 24) {',
  '      fresh.push({ node: p, text: p.textContent });',
  '    }',
  '  });',
  '  typeParagraphs(fresh);',
  '}',
  '',
  '',
].join('\n');

s = s.slice(0, start) + block + s.slice(end);
n++; console.log('· 換成 typeOne/typeParagraphs/pageDownHalf');

/* ② 自動接章不再自行打字（改由翻頁觸發） */
s = s.replace(
  /    \/\/ 自動接章（往下滑）：只讓「畫面上那一段空白」快速出字，不是整章打字\n    if \(typed\.length\) \{\n      const stream = document\.querySelector\('#stream'\);\n      primeFastType\(typed, stream\);\n    \}/,
  '    // 自動接章：不主動打字（打字由 Enter 翻頁觸發，JOJO 2026-11-06）'
);

/* ③ 暴露給 debug / 測試 */
if (!s.includes('pageDown: pageDownHalf')) {
  s = s.replace('window.__moyuDebug = {', 'window.__moyuDebug = {\n  pageDown: pageDownHalf,');
  n++; console.log('· debug 介面加上 pageDown');
}

fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
