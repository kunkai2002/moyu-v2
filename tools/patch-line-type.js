// 逐字 → 「一行一行」出字（JOJO 2026-11-06：想像 ds Flash 思考的速度）
//   做法：先量整段的行數與行容量，然後一次吐一整行、每行約 35ms（很快但看得出是一行一行）
//   段落高度先用 min-height 鎖住，避免行數增加時把下面內容推來推去
//   node tools/patch-line-type.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('function typeOne(node, text, done) {');
const end = s.indexOf('\nfunction typeParagraphs(list) {');
if (start < 0 || end < 0) { console.error('❌ 找不到 typeOne'); process.exit(1); }

const body = [
  'function typeOne(node, text, done) {',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  if (reduce) { node.textContent = text; if (done) done(); return; }',
  '  const cs = getComputedStyle(node);',
  '  const lh = parseFloat(cs.lineHeight) || 24;',
  '  /* 先放完整文字量出行數與「一行大約幾個字」，再把高度鎖住、清空後一行一行吐。',
  '     JOJO 要的是「一行一行」而不是逐字，所以步進單位是一行（約 35ms 一行，像 ds Flash 思考速度）。 */',
  '  node.textContent = text;',
  '  const fullH = node.scrollHeight;',
  '  const lines = Math.max(1, Math.round(fullH / lh));',
  '  const perLine = Math.max(1, Math.ceil(text.length / lines));',
  '  node.style.minHeight = fullH + \'px\';',
  '  node.textContent = \'\';',
  '  let shown = 0;',
  '  let timer = null;',
  '  const finish = () => {',
  '    node.textContent = text;',
  '    node.style.minHeight = \'\';',
  '    if (timer) clearTimeout(timer);',
  '    timer = null;',
  '    if (done) done();',
  '  };',
  '  const tick = () => {',
  '    shown = Math.min(text.length, shown + perLine);',
  '    node.textContent = text.slice(0, shown);',
  '    if (shown >= text.length) { finish(); return; }',
  '    timer = setTimeout(tick, 35);',
  '  };',
  '  timer = setTimeout(tick, 16);',
  '  // 保險：1.2 秒內一定補滿（視窗被節流也不會留空白段落）',
  '  setTimeout(() => { if (node.textContent !== text) finish(); }, 1200);',
  '}',
  '',
].join('\n');

s = s.slice(0, start) + body + s.slice(end);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ typeOne 改成「一行一行」出字');
