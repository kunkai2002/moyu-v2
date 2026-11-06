// 加上「工具呼叫列」的樣式到 ui/dsh-polish-2.css（⏺ Read(...) ＋ ⎿ 結果）
//   node tools/patch-toolrow-style.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'ui', 'dsh-polish-2.css');
let s = fs.readFileSync(p, 'utf8');
const MARK = '/* ── 工具呼叫列（⏺ Read(src/…) ＋ ⎿ 結果）';
if (s.includes(MARK)) { console.log('已經有樣式，跳過'); process.exit(0); }

const css = [
  '',
  '/* ── 工具呼叫列（⏺ Read(src/…) ＋ ⎿ 結果）',
  '     JOJO 2026-11-06：畫面上除了「已完成思考」與紅綠 diff，還要有更多像編碼工具的痕跡。 */',
  ':root[data-shell="dsh"] .toolrow{',
  '  margin:var(--p3) 0 var(--p2);',
  '  font-family:var(--dsh-font-code);font-size:11px;line-height:18px;',
  '  color:var(--p-fg-muted);',
  '  display:flex;align-items:baseline;gap:6px;',
  '}',
  ':root[data-shell="dsh"] .toolrow .tr-bu{color:color-mix(in srgb, var(--acc) 75%, var(--fg3));flex:none}',
  ':root[data-shell="dsh"] .toolrow .tr-v{color:var(--fg2);flex:none}',
  ':root[data-shell="dsh"] .toolrow .tr-a{color:var(--p-fg-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  ':root[data-shell="dsh"] .toolrow-res{',
  '  margin:0 0 var(--p2) 12px;padding-left:14px;',
  '  font-family:var(--dsh-font-code);font-size:11px;line-height:18px;',
  '  color:color-mix(in srgb, var(--fg3) 85%, transparent);',
  '  display:flex;align-items:baseline;gap:6px;',
  '}',
  ':root[data-shell="dsh"] .toolrow-res .tr-bar{opacity:.65;flex:none}',
  '',
].join('\n');

fs.writeFileSync(p, s.trimEnd() + '\n' + css, 'utf8');
console.log('✅ 加上 .toolrow 樣式');
