// 最終實作：翻頁出字用「時間軸」驅動（不靠 tick 次數），隱藏視窗被節流也一定會完成。
//   k = 經過時間 / 2 秒
//   已顯示字數 = total × k（依段落順序分配）→ 頁面往上頂 = budget × k
//   node tools/patch-timebased-page.js
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
  '  if (from >= max - 2) {                              // 到底：接下一章',
  '    const sent = document.querySelector(\'.flow-more\');',
  '    if (sent) sent.click();',
  '    return;',
  '  }',
  '  const sr = s.getBoundingClientRect();',
  '  const list = [];',
  '  document.querySelectorAll(\'#stream .p\').forEach((p) => {',
  '    if (p.dataset.typed === \'1\') return;',
  '    const r = p.getBoundingClientRect();',
  '    if (r.bottom > sr.top && r.top < sr.bottom + view * 0.5) {',
  '      p.dataset.full = p.textContent;',
  '      p.dataset.typed = \'1\';',
  '      const h = p.scrollHeight;',
  '      if (h > 0) p.style.minHeight = h + \'px\';       // 鎖高度，捲動才不會被夾',
  '      p.textContent = \'\';',
  '      list.push(p);',
  '    }',
  '  });',
  '  const budget = Math.round(view / 2);',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  const fillAll = () => {',
  '    list.forEach((p) => {',
  '      if (p.dataset.full != null) { p.textContent = p.dataset.full; delete p.dataset.full; }',
  '      p.style.minHeight = \'\';',
  '    });',
  '  };',
  '  if (!list.length || reduce) {',
  '    fillAll();',
  '    s.scrollTop = Math.min(max, from + budget);',
  '    return;',
  '  }',
  '',
  '  /* 時間軸：2 秒內把這批字吐完，同時頁面往上頂到半屏。',
  '     用「經過時間」換算進度，而不是靠 tick 次數 —— 隱藏視窗／背景頁的計時器會被',
  '     節流到 1 秒一次（實測 3.6 秒只跑 3 個 tick），靠次數會永遠做不完。 */',
  '  const total = list.reduce((n, p) => n + (p.dataset.full || \'\').length, 0);',
  '  const DURATION = 2000;',
  '  const t0 = Date.now();',
  '  let timer = null;',
  '  const step = () => {',
  '    const k = Math.min(1, (Date.now() - t0) / DURATION);',
  '    let left = Math.floor(total * k);',
  '    for (const p of list) {',
  '      const full = p.dataset.full;',
  '      if (full == null) continue;',
  '      if (left >= full.length) { p.textContent = full; delete p.dataset.full; p.style.minHeight = \'\'; left -= full.length; }',
  '      else { p.textContent = full.slice(0, Math.max(0, left)); left = 0; }',
  '    }',
  '    s.scrollTop = Math.min(max, from + Math.round(budget * k));',
  '    if (k >= 1) { fillAll(); if (timer) clearInterval(timer); timer = null; return; }',
  '    timer = timer || setInterval(step, 16);',
  '  };',
  '  step();',
  '  timer = setInterval(step, 16);',
  '  setTimeout(() => { if (timer) { clearInterval(timer); timer = null; } fillAll(); s.scrollTop = Math.min(max, from + budget); }, 2600);',
  '}',
  '',
  '',
].join('\n');
s = s.slice(0, a1) + fn + s.slice(a2);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 翻頁出字改成時間軸驅動（2 秒）');
