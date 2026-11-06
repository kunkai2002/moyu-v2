// 視覺模型回饋的三條收尾（8/10 → 再往上）：
//   ① 淺色 diff 紅綠太重 → 降飽和
//   ② 狀態列資訊太密 → 只留 main*／章節位置／tok/s
//   ③ 側欄 active 回饋太弱 → 目前書名／新對話給一點主色
//   node tools/patch-taste-final.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'taste.css');
let s = fs.readFileSync(p, 'utf8');
const MARK = '/* ⑯ 收尾三條';
if (s.includes(MARK)) { console.log('已經加過，跳過'); process.exit(0); }

s += [
  '',
  MARK + '（視覺回饋 2026-11-06） */',
  '/* 淺色模式的 diff 紅綠降飽和（深色不動） */',
  ':root[data-theme="dsh-light"][data-shell="dsh"] .cc-add{background:color-mix(in srgb,var(--ok) 6%,transparent)}',
  ':root[data-theme="dsh-light"][data-shell="dsh"] .cc-del{background:color-mix(in srgb,#e06b6b 7%,transparent)}',
  '/* 狀態列只留三件真正有用的事：分支、章節位置、tok/s */',
  ':root[data-shell="dsh"] .statusbar #sbTime,:root[data-shell="dsh"] .statusbar #sbCpu,:root[data-shell="dsh"] .statusbar #sbNet{display:none}',
  ':root[data-shell="dsh"] .statusbar .sb-r .sb-item:not(#sbChapter):not(#sbTok){display:none}',
  '/* 側欄回饋：目前這本書（最近的第一列）與新對話給一點主色 */',
  ':root[data-shell="dsh"] .side-recent .sr-row:first-child{box-shadow:inset 2px 0 0 var(--acc)}',
  ':root[data-shell="dsh"] .sa-new:hover{box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--acc) 45%,transparent),0 1px 2px rgba(0,0,0,.1)}',
  '',
].join('\n');

fs.writeFileSync(p, s, 'utf8');
console.log('✅ 加上收尾三條');
