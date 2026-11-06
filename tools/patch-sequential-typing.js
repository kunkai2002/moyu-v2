// 修正：段落嚴格「一段打完才開始下一段」（JOJO 2026-11-06）
//   原因：翻頁動畫每個 tick 都呼叫 typeParagraphs()，每次都開一個新的排程器，
//   於是多段同時在長（上一段還沒吐完、下一段就開始）。改成**單一排程器 + 佇列**。
//   node tools/patch-sequential-typing.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const t1 = s.indexOf('function typeOne(node, text, done) {');
const t2 = s.indexOf('function pageDownHalf() {', t1);
if (t1 < 0 || t2 < 0) { console.error('❌ 找不到 typeOne/typeParagraphs 區塊'); process.exit(1); }

const block = [
  '/* ── 逐段出字：單一排程器、嚴格排隊 ─────────────────────────────',
  '   一次只吐一段；這一段吐完才換下一段（JOJO 2026-11-06：不能兩段同時長）。',
  '   翻頁動畫會一直把「剛進畫面」的段落丟進來，這裡只排隊、不併發。',
  '   節奏：每 28ms 吐 4 個字 → 一段 60 字約 0.42 秒，半屏 6 段約 2 秒。 */',
  'const __typeQueue = [];',
  'let __typeTimer = null;',
  'let __typeCurrent = null;',
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
  '  const per = 4;                                  // 一次 4 個字（3–5 之間）',
  '  let shown = 0;',
  '  __typeTimer = setInterval(() => {',
  '    shown = Math.min(e.text.length, shown + per);',
  '    e.node.textContent = e.text.slice(0, shown);',
  '    if (shown >= e.text.length) {',
  '      clearInterval(__typeTimer);',
  '      __typeTimer = null;',
  '      e.node.textContent = e.text;',
  '      e.node.style.minHeight = \'\';',
  '      __typeCurrent = null;',
  '      __typeNext();                                // 這一段完了才換下一段',
  '    }',
  '  }, 28);',
  '  setTimeout(() => {                               // 保險：單段最多 2 秒補滿，不會卡住整條佇列',
  '    if (__typeCurrent === e && e.node.textContent !== e.text) {',
  '      clearInterval(__typeTimer); __typeTimer = null;',
  '      e.node.textContent = e.text; e.node.style.minHeight = \'\';',
  '      __typeCurrent = null; __typeNext();',
  '    }',
  '  }, 2000);',
  '}',
  '',
  'function typeParagraphs(list) {',
  '  const fresh = (list || []).filter((e) => e && e.node && e.node.isConnected && e.node.dataset.typed !== \'1\');',
  '  if (!fresh.length) return;',
  '  fresh.forEach((e) => {',
  '    e.node.dataset.typed = \'1\';',
  '    const prev = e.node.textContent;',
  '    e.node.textContent = e.text;                   // 量完整高度，先鎖住避免版面跳動',
  '    const h = e.node.scrollHeight;',
  '    e.node.style.minHeight = h + \'px\';',
  '    e.node.textContent = prev;',
  '    e.node.textContent = \'\';',
  '    __typeQueue.push(e);',
  '  });',
  '  // 依 DOM 順序排隊（翻頁時可能先後丟進來，順序還是要對）',
  '  __typeQueue.sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));',
  '  __typeNext();',
  '}',
  '',
  '',
].join('\n');

s = s.slice(0, t1) + block + s.slice(t2);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 出字改成單一排程器、嚴格一段一段');
