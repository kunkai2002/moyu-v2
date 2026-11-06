// test-reveal 改成用「被清空但還沒長完的段落（空白段）歸零」當完成訊號：
// 比「所有段落同時等於最終長度」穩（後者有段落本來就短、也會被後續翻頁再清空一次）。
//   node tools/patch-reveal-metric.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-reveal.js');
let s = fs.readFileSync(p, 'utf8');
const a = s.slice(s.indexOf('  // ① 哪時全部吐完'), s.indexOf('  // ② 同一時間最多一段在長'));
const b = [
  '  // ① 完成訊號：從「第一次出現空白段」到「空白段歸零」 = 這批出字花多久',
  '  let startAt = null;',
  '  let doneAt = null;',
  '  for (const s of samples) {',
  '    const blanks = Object.keys(s.m).filter((pi) => s.m[pi] === 0).length;',
  '    if (startAt == null && blanks > 0) startAt = s.t;',
  '    if (startAt != null && blanks === 0 && s.t > startAt) { doneAt = s.t - startAt; break; }',
  '  }',
  '  (doneAt != null && doneAt <= 2600)',
  '    ? ok(\'整批在 2 秒上下顯示完\', `從開始出字到沒有空白段 +${doneAt}ms（預算 2000ms）`)',
  '    : bad(\'整批顯示超過 2 秒太多\', doneAt == null ? \'3.2 秒內還有空白段\' : `+${doneAt}ms`);',
  '  (doneAt != null && doneAt >= 800)',
  '    ? ok(\'也不是瞬間全出（>0.8 秒，看得出來）\', `+${doneAt}ms`)',
  '    : bad(\'太快，看不出逐段出現\', `+${doneAt}ms`);',
  '',
].join('\n');
if (!a) { console.error('❌ 找不到斷言區塊'); process.exit(1); }
s = s.replace(a, b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ test-reveal 改用「空白段歸零」當完成訊號');
