// 修 test-reveal：「吐完時間」要從**第一次被清空**起算（在那之前所有段落本來就是完整的）
//   node tools/patch-reveal-timing.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-reveal.js');
let s = fs.readFileSync(p, 'utf8');

const a = s.slice(s.indexOf('  // ① 哪時全部吐完'), s.indexOf('  // ② 同一時間最多一段在長'));
const b = [
  '  // ① 哪時全部吐完：從「第一次有段落被清空」起算，到所有段落回到最終長度',
  '  const targets = Object.keys(finals).filter((pi) => finals[pi] > 0);',
  '  let startAt = null;',
  '  for (const s of samples) {',
  '    if (targets.some((pi) => s.m[pi] !== undefined && s.m[pi] < finals[pi])) { startAt = s.t; break; }',
  '  }',
  '  let doneAt = null;',
  '  if (startAt != null) {',
  '    for (const s of samples) {',
  '      if (s.t < startAt) continue;',
  '      const allDone = targets.every((pi) => (s.m[pi] || 0) === finals[pi]);',
  '      if (allDone) { doneAt = s.t - startAt; break; }',
  '    }',
  '  }',
  '  (doneAt != null && doneAt <= 2600)',
  '    ? ok(\'整批在 2 秒上下顯示完\', `從開始出字到全部完成 +${doneAt}ms（預算 2000ms）`)',
  '    : bad(\'整批顯示超過 2 秒太多\', doneAt == null ? \'3.2 秒內沒吐完\' : `+${doneAt}ms`);',
  '  (doneAt != null && doneAt >= 900)',
  '    ? ok(\'也不是瞬間全出（>0.9 秒，看得出來）\', `+${doneAt}ms`)',
  '    : bad(\'太快，看不出逐段出現\', `+${doneAt}ms`);',
  '',
].join('\n');
if (!a) { console.error('❌ 找不到斷言區塊'); process.exit(1); }
s = s.replace(a, b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ test-reveal 改從「第一次清空」起算');
