// 抽屜收起來時直接 display:none（比 translateX(-101%) 更乾淨）：
//   · 不會被 elementFromPoint 命中（820 時它蓋住了頂欄的上一頁/下一頁 → 驗收誤判）
//   · 不會影響 scrollWidth
//   · 開啟時用 keyframe 滑入，關閉不用動畫
//   node tools/patch-drawer-display.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'dsh-polish-3.css');
let s = fs.readFileSync(p, 'utf8');
const MARK = '/* 抽屜關閉時直接移除版面';
if (s.includes(MARK)) { console.log('已經加過，跳過'); process.exit(0); }

s += [
  '',
  MARK + '（避免 translate 出去的抽屜仍被命中） */',
  ':root[data-shell="dsh"] .app.side-overlay:not(.side-open) .side{display:none}',
  ':root[data-shell="dsh"] .app.toc-overlay:not(.toc-open) .dsh-right{display:none}',
  '/* 開啟時滑入（原本是 transform 過場，改成 keyframe 才不會跟 display 打架） */',
  '@keyframes taste-slide-left{from{transform:translateX(-16px);opacity:0}to{transform:none;opacity:1}}',
  '@keyframes taste-slide-right{from{transform:translateX(16px);opacity:0}to{transform:none;opacity:1}}',
  ':root[data-shell="dsh"] .app.side-overlay.side-open .side{animation:taste-slide-left var(--dsh-dur) var(--dsh-ease) both}',
  ':root[data-shell="dsh"] .app.toc-overlay.toc-open .dsh-right{animation:taste-slide-right var(--dsh-dur) var(--dsh-ease) both}',
  '',
].join('\n');
fs.writeFileSync(p, s, 'utf8');
console.log('✅ 抽屜關閉 display:none、開啟滑入');
