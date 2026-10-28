// 給 e2e-buttons.js 加步驟日誌與較長的 protocolTimeout
const fs = require('fs');
const f = 'tools/e2e-buttons.js';
let s = fs.readFileSync(f, 'utf8');

s = s.replace(
  'defaultViewport: null })',
  'defaultViewport: null, protocolTimeout: 600000 })'
);

const steps = [
  ['/* ── 1. 頂欄每一顆 ── */', '· [1] 頂欄'],
  ['/* ── 2. 溢出選單 ── */', '· [2] 溢出'],
  ['/* ── 3. 首頁 ── */', '· [3] 首頁'],
  ['/* ── 4. 歷史 ── */', '· [4] 歷史'],
  ['/* ── 5. 右鍵選單 ── */', '· [5] 右鍵'],
  ['/* ── 6. 拖拽 ── */', '· [6] 拖拽'],
  ['/* ── 7. 小視窗 ── */', '· [7] 小窗'],
  ['/* ── 8. 連讀 ── */', '· [8] 連讀'],
];
for (const [marker, label] of steps) {
  if (s.includes(marker) && !s.includes(`console.log('${label}')`)) {
    s = s.replace(marker, `console.log('${label}');\n  ${marker}`);
  }
}

fs.writeFileSync(f, s, 'utf8');
console.log('instrumented');
