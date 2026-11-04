// 把 ui-lint 的 violations 依「類別 × 影響次數」彙總（決定先修哪幾類）
//   node tools/ui-lint-summary.js [--all]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const p = path.join(ROOT, '_probe', 'ui-lint.json');
if (!fs.existsSync(p)) { console.error('先跑 node tools/ui-lint.js'); process.exit(1); }
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const vs = j.violations || [];
const all = process.argv.includes('--all');

const byCat = new Map();
for (const v of vs) {
  const key = v.category;
  if (!byCat.has(key)) byCat.set(key, []);
  byCat.get(key).push(v);
}
for (const [cat, list] of byCat) {
  const total = list.reduce((n, v) => n + (v.count || 1), 0);
  console.log(`\n════ ${cat}：${list.length} 種 / ${total} 次 ════`);
  const sorted = list.slice().sort((a, b) => (b.count || 1) - (a.count || 1));
  const show = all ? sorted : sorted.slice(0, 12);
  for (const v of show) {
    console.log(`  ${String(v.count || 1).padStart(4)}× ${v.selector}`);
    console.log(`        ${v.actual}  →  期望 ${v.expected}`);
  }
  if (!all && sorted.length > show.length) console.log(`  …另有 ${sorted.length - show.length} 種（--all 看全部）`);
}
