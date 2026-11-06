// 換掉 ui/app.js 的 primeFastType：改成「捲進畫面才出字」（不是整章打字）
//   node tools/patch-fasttype.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'ui', 'app.js');
const s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('/* 「快速出字」');
const end = s.indexOf('function streamParagraphs(');
if (start < 0 || end < 0 || end < start) { console.error('❌ 找不到 primeFastType 區塊'); process.exit(1); }

const body = [
  '/* 「快速出字」：不是整章打字，而是「原本底部 → 新底部」那一段在填字。',
  '   做法：接章時**不清空**任何段落（新章大多在畫面下方，看不到）；',
  '   使用者往下捲、某一段即將進入畫面時，才當場清空＋快速長出來（每段約 200ms），',
  '   前 3 段間隔 45ms 錯開，看起來就是一段接一段在生成。',
  '   · 只動 textContent，不動結構／data-pi；減少動態時全部一次畫完',
  '   · 每段有 600ms 保險補滿，不會留下空白段落 */',
  'function primeFastType(entries, stream) {',
  '  const reduce = window.matchMedia && window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;',
  '  if (reduce || !entries || !entries.length || !stream) return;',
  '  const sr = stream.getBoundingClientRect();',
  '  const nowTop = sr.top - 120;',
  '  const queue = entries.filter((e) => e.node.getBoundingClientRect().bottom >= nowTop);',
  '  if (!queue.length) return;',
  '',
  '  function typeNode(node, text, ms, delay) {',
  '    setTimeout(() => {',
  '      node.textContent = \'\';',
  '      const t0 = Date.now();',
  '      const step = () => {',
  '        const k = Math.min(1, (Date.now() - t0) / ms);',
  '        const n = k >= 1 ? text.length : Math.max(1, Math.floor(text.length * k));',
  '        node.textContent = text.slice(0, n);',
  '        if (k >= 1) return;',
  '        setTimeout(step, 16);',
  '      };',
  '      setTimeout(step, 16);',
  '    }, delay || 0);',
  '  }',
  '',
  '  let cursor = 0;',
  '  const fire = (e) => {',
  '    typeNode(e.node, e.text, 200, (cursor++ % 3) * 45);',
  '    setTimeout(() => { if (!e.node.textContent) e.node.textContent = e.text; }, 600);',
  '  };',
  '',
  '  if (\'IntersectionObserver\' in window) {',
  '    const io = new IntersectionObserver((list) => {',
  '      for (const it of list) {',
  '        if (!it.isIntersecting) continue;',
  '        io.unobserve(it.target);',
  '        const e = queue.find((x) => x.node === it.target);',
  '        if (e) fire(e);',
  '      }',
  '    }, { root: stream, rootMargin: \'0px 0px 160px 0px\' });',
  '    queue.forEach((e) => io.observe(e.node));',
  '  } else {',
  '    queue.filter((e) => e.node.getBoundingClientRect().top <= sr.bottom).forEach((e) => fire(e));',
  '  }',
  '}',
  '',
  '',
].join('\n');

fs.writeFileSync(p, s.slice(0, start) + body + s.slice(end), 'utf8');
console.log('✅ primeFastType 換成「捲進畫面才出字」');
