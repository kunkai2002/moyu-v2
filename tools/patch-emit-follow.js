// ① Enter：空白＝往下翻半屏；有字＝照舊送出（JOJO 2026-11-06 最後一條）
// ② 翻頁改成「字先出來、把頁一點點往上頂」：邊吐字邊捲，捲到半屏就停（不再先滑再出字）
//   node tools/patch-emit-follow.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

/* ── ① Enter 語意 ─────────────────────────────────────────── */
const oldKey = s.slice(s.indexOf("    input.addEventListener('keydown', (e) => {"), s.indexOf("    input.addEventListener('input', () => {"));
const newKey = [
  "    input.addEventListener('keydown', (e) => {",
  "      if (e.key !== 'Enter') return;",
  "      e.preventDefault();",
  "      /* JOJO 2026-11-06：輸入框空白時 Enter＝往下翻半屏；有打字就照舊送出指令。",
  "         Shift+Enter 仍然換行；Alt/Ctrl+Enter 一律送出（保險鍵）。 */",
  "      if (e.shiftKey) {",
  "        input.value += '\\n';",
  "        input.dispatchEvent(new Event('input'));",
  "        return;",
  "      }",
  "      const typed = input.value.trim();",
  "      if (e.altKey || e.ctrlKey || e.metaKey || typed) {",
  "        const v = input.value;",
  "        input.value = '';",
  "        input.dispatchEvent(new Event('input'));",
  "        handleInput(v);",
  "        return;",
  "      }",
  "      pageDownHalf();",
  "    });",
  "",
].join('\n');
if (!oldKey) { console.error('❌ 找不到 keydown 區塊'); process.exit(1); }
s = s.split(oldKey).join(newKey);

/* ── ② 出字驅動捲動 ─────────────────────────────────────── */
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
  '  if (from >= max - 2) {                        // 到底：接下一章',
  '    const sent = document.querySelector(\'.flow-more\');',
  '    if (sent) sent.click();',
  '    return;',
  '  }',
  '  const sr = s.getBoundingClientRect();',
  '  /* 收集「畫面上還沒打過字」的段落：字先出來、頁面被一點點往上頂，頂到半屏就停 */',
  '  const list = [];',
  '  document.querySelectorAll(\'#stream .p\').forEach((p) => {',
  '    if (p.dataset.typed === \'1\') return;',
  '    const r = p.getBoundingClientRect();',
  '    if (r.bottom > sr.top && r.top < sr.bottom + view * 0.5) {',
  '      p.dataset.full = p.textContent;',
  '      p.dataset.typed = \'1\';',
  '      p.textContent = \'\';',
  '      list.push(p);',
  '    }',
  '  });',
  '  const budget = Math.round(view / 2);           // 這一頁要往上頂多少',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  if (!list.length || reduce) {',
  '    list.forEach((p) => { p.textContent = p.dataset.full; delete p.dataset.full; });',
  '    s.scrollTop = Math.min(max, from + budget);',
  '    return;',
  '  }',
  '  const total = list.reduce((n, p) => n + (p.dataset.full || \'\').length, 0);',
  '  const per = 3;                                  // 一次 3 個字（幾個字幾個字一起）',
  '  const ticks = Math.max(1, Math.ceil(total / per));',
  '  const TICK = Math.max(16, Math.min(90, Math.round(1800 / ticks)));   // 整批約 1.8 秒',
  '  let i = 0;',
  '  let shown = 0;',
  '  let moved = 0;',
  '  let timer = null;',
  '  const finish = () => {',
  '    if (timer) clearInterval(timer);',
  '    timer = null;',
  '    list.forEach((p) => { if (p.dataset.full != null) { p.textContent = p.dataset.full; delete p.dataset.full; } });',
  '  };',
  '  timer = setInterval(() => {',
  '    if (i >= list.length) { finish(); return; }',
  '    const p = list[i];',
  '    const full = p.dataset.full || \'\';',
  '    shown = Math.min(full.length, shown + per);',
  '    p.textContent = full.slice(0, shown);',
  '    /* 邊吐字邊把頁往上頂：整批吐完剛好頂到半屏，節奏不會前快後慢 */',
  '    moved = Math.min(budget, moved + (budget * per) / Math.max(1, total));',
  '    s.scrollTop = Math.min(max, from + moved);',
  '    if (shown >= full.length) { delete p.dataset.full; i++; shown = 0; }',
  '  }, TICK);',
  '  setTimeout(finish, Math.max(900, 1800) + 400);   // 保險',
  '}',
  '',
  '',
].join('\n');
s = s.slice(0, a1) + fn + s.slice(a2);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ Enter 語意 + 出字驅動捲動');
