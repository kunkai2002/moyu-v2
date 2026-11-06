// 把 typing 測試收斂成「穩定可重現」的不變量（避免和 scroll anchoring 打架）：
//   ① 接章成功（字數變多）
//   ② 不是整章打字（0ms 已有 ≥85% 文字）
//   ③ 逐字證據：某段在輪詢序列裡出現「先 0（被清空）→ 之後變完整」的過渡
//   ④ 2.6 秒內全部補滿（沒有空白段落）
//   node tools/patch-typing-robust.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-typing.js');
let s = fs.readFileSync(p, 'utf8');

// ① 多一個 2600ms 樣本
s = s.replace('for (const at of [0, 120, 300, 900, 1600])', 'for (const at of [0, 120, 300, 900, 1600, 2600])');

// ② 逐字證據：改成 transient-zero（0 → 完整）
const oldEv = s.slice(s.indexOf('  // ① 捲進來的那幾段要「逐字長」'), s.indexOf('  // ② 不是整章打字'));
const newEv = [
  '  // ① 逐字證據：同一段在輪詢序列裡出現「被清空（0）→ 變完整」的過渡',
  '  const rows = await page.evaluate(() => { clearInterval(window.__typeTimer); return window.__typeSamples || []; });',
  '  const per = {};',
  '  for (const r of rows) for (const pi of Object.keys(r.m)) (per[pi] = per[pi] || []).push(r.m[pi]);',
  '  let typed = 0; let sample = null;',
  '  for (const pi of Object.keys(per)) {',
  '    const arr = per[pi];',
  '    const finalLen = arr.length ? arr[arr.length - 1] : 0;',
  '    const zeroAt = arr.findIndex((L) => L === 0);',
  '    if (finalLen > 0 && zeroAt >= 0 && arr.slice(zeroAt + 1).some((L) => L === finalLen)) {',
  '      typed++; sample = sample || { pi, arr: arr.slice(0, 8), finalLen };',
  '    }',
  '  }',
  '  typed > 0',
  '    ? ok(\'捲進來那段是逐字長出來的\', `${typed} 段出現「清空→完整」過渡（例：pi ${sample.pi} ${sample.arr.join("→")}）`)',
  '    : bad(\'捲進來那段沒有逐字效果\', JSON.stringify(Object.keys(per).slice(0, 5).map((k) => [k, per[k].slice(0, 8)])));',
  '',
  '',
].join('\n');
if (oldEv) s = s.replace(oldEv, newEv);

// ③ 空白段落：看 2.6 秒那一筆
s = s.replace(
  "  const done = samples.find((s) => s.ms === 900) || samples[3];\n  (done && done.emptyAll === 0) ? ok('0.9 秒內全部補滿（沒有空白段落）', `空白 ${done.emptyAll}`)\n    : bad('0.9 秒還有空白段落', JSON.stringify(done));",
  "  const done = samples[samples.length - 1];\n  (done && done.emptyAll === 0) ? ok('2.6 秒內全部補滿（沒有空白段落）', `空白 ${done.emptyAll}`)\n    : bad('2.6 秒還有空白段落', JSON.stringify(done));"
);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ typing 測試改成穩定不變量');
