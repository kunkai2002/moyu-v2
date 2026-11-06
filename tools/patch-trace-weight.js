// 微調「工具痕跡」的視覺權重：工具列/步進列稍微提亮（原本偏隱形），diff 塊收斂一點
//   node tools/patch-trace-weight.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function edit(rel, pairs) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  let n = 0;
  for (const [a, b] of pairs) {
    if (s.includes(a)) { s = s.split(a).join(b); n++; }
    else console.log(`  ! ${rel}: 找不到 ${a.slice(0, 48)}`);
  }
  if (n) { fs.writeFileSync(p, s, 'utf8'); console.log(`· ${rel} 改了 ${n} 處`); }
  return n;
}

// ① 工具列 / 結果行：提亮到 fg2 與 fg3 之間
edit('ui/dsh-polish-2.css', [
  [':root[data-shell="dsh"] .toolrow{',
   ':root[data-shell="dsh"] .toolrow{'],
  ['  color:var(--p-fg-muted);\n  display:flex;align-items:baseline;gap:6px;\n}',
   '  color:color-mix(in srgb, var(--fg3) 45%, var(--fg2));\n  display:flex;align-items:baseline;gap:6px;\n}'],
  [':root[data-shell="dsh"] .toolrow .tr-a{color:var(--p-fg-muted);',
   ':root[data-shell="dsh"] .toolrow .tr-a{color:color-mix(in srgb, var(--fg3) 55%, var(--fg2));'],
  ['  color:color-mix(in srgb, var(--fg3) 85%, transparent);\n  display:flex;align-items:baseline;gap:6px;\n}',
   '  color:color-mix(in srgb, var(--fg3) 60%, var(--fg2));\n  display:flex;align-items:baseline;gap:6px;\n}'],
]);

// ② 步進列（思考中／已完成）也提亮一點
edit('ui/dsh-polish-2.css', [
  ['  color:var(--p-fg-muted);\n  transition:color var(--dsh-dur) var(--dsh-ease), opacity var(--dsh-dur) var(--dsh-ease);',
   '  color:color-mix(in srgb, var(--fg3) 55%, var(--fg2));\n  transition:color var(--dsh-dur) var(--dsh-ease), opacity var(--dsh-dur) var(--dsh-ease);'],
  [':root[data-shell="dsh"] .step.done{color:color-mix(in srgb, var(--fg3) 88%, transparent)}',
   ':root[data-shell="dsh"] .step.done{color:color-mix(in srgb, var(--fg3) 62%, var(--fg2))}'],
]);

// ③ diff 塊收斂（面積大、最搶眼）：底色再淡一階、內距小一點
edit('ui/dsh-polish-2.css', [
  ['  background:color-mix(in srgb, var(--dsh-color-module) 72%, transparent);',
   '  background:color-mix(in srgb, var(--dsh-color-module) 52%, transparent);'],
]);
