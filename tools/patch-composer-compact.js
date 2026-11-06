// 輸入框收斂成單列（JOJO：「輸入框占用太多了」「enter 送出那塊不要了，右邊加個回車圖標」）
//   node tools/patch-composer-compact.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'ui', 'dsh-polish.css');
let s = fs.readFileSync(p, 'utf8');
const MARK = '/* ── 輸入卡收斂成單列';
if (s.includes(MARK)) { console.log('已經收斂過，跳過'); process.exit(0); }

const css = [
  '',
  MARK + '（2026-11-06）',
  '     原本：一列輸入 ＋ 一列「Enter 送出／Shift+Enter 換行」＋ 說明／模式／模型 三顆散在底部，',
  '     整塊 100–110px 高。現在全部併進同一列，整張卡約 48px。 */',
  ':root[data-shell="dsh"] .composer{padding:0 var(--dsh-clearance) 8px}',
  ':root[data-shell="dsh"] .composer .box{',
  '  padding:6px 8px 6px 0;gap:0;',
  '}',
  ':root[data-shell="dsh"] .composer .box-line{',
  '  align-items:center;gap:8px;',
  '  padding:0 6px 0 14px;',
  '}',
  ':root[data-shell="dsh"] .composer .box-line .prompt{',
  '  line-height:36px;font-size:13px;color:var(--p-fg-muted);',
  '}',
  ':root[data-shell="dsh"] .composer #input{',
  '  min-height:36px;padding:6px 4px 6px 0;line-height:24px;',
  '}',
  ':root[data-shell="dsh"] .composer .box-foot-r{',
  '  margin-left:auto;font-size:11px;line-height:16px;color:var(--p-fg-muted);white-space:nowrap;',
  '}',
  ':root[data-shell="dsh"] .composer .hint-btn{width:26px;height:26px;flex:none}',
  ':root[data-shell="dsh"] .composer .hint-btn svg{width:15px;height:15px}',
  '/* 右下角回車鍵：跟 Enter 同一個動作（往下翻半屏），做成低調的主鍵 */',
  ':root[data-shell="dsh"] .composer .enter-btn{',
  '  width:28px;height:28px;border-radius:var(--dsh-radius-sm);',
  '  color:var(--fg);background:var(--dsh-color-module);',
  '  box-shadow:inset 0 0 0 .5px var(--line-strong);',
  '}',
  ':root[data-shell="dsh"] .composer .enter-btn:hover{background:var(--dsh-color-hover)}',
  ':root[data-shell="dsh"] .composer .enter-btn:active{transform:translateY(.5px)}',
  '',
].join('\n');

fs.writeFileSync(p, s.trimEnd() + '\n' + css, 'utf8');
console.log('✅ 輸入卡收斂成單列');
