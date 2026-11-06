// 把 ui/taste.css 換成 taste 隊友提案的「超集」版本（docs/審美升級_20261106.md §4）
// 並修掉根因：--dsh-side-pad 引用了未定義的 --dsh-sidebar-inline-padding → 產生器改成代入實際值
//   node tools/apply-taste-proposal.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let n = 0;

/* ① taste.css 換成提案版（保留檔頭說明） */
{
  const p = path.join(ROOT, 'ui', 'taste.css');
  const css = [
    '/* ══════════════════════════════════════════════════════════════',
    '   審美層（taste.css）· 2026-11-06 · 第 6 層（a11y 之後最後載入）',
    '   ─────────────────────────────────────────────────────────────',
    '   Design Read：假裝成 AI 編碼工具的長篇閱讀器，給每天用 VS Code 的人；',
    '   語言是工具的中性灰＋等寬節奏，方向是 DSH 真值復刻 —— 美感只能來自紀律',
    '   （階梯、對齊、留白、克制），不能來自新裝飾。',
    '   旋鈕：VARIANCE 2（三欄工具殼不准有新構圖）／MOTION 3（只做回饋，翻頁靠 JS）',
    '        ／DENSITY 8（外殼密、閱讀區鬆）。',
    '   只用既有變數（--dsh-* / --fg* / --acc）＋ 4/8/12/16 間距。',
    '   真值幾何不動：側欄 280、頂欄 76、輸入卡 28、正文 14/24。',
    '   ══════════════════════════════════════════════════════════════ */',
    '',
    '/* ① 側欄內距：還原真值 6px 12px（原本引用了一個沒定義的變數被算成 0） */',
    ':root[data-shell="dsh"] .side{padding:6px 12px}',
    '',
    '/* ② 右欄是「一塊面板」，不是正文的右邊界（跟左欄同一種底） */',
    ':root[data-shell="dsh"] .dsh-right{background:var(--dsh-color-sidebar-fill)}',
    '',
    '/* ③ <1100 時目錄只剩頂欄那顆圖示：給它底，開著時再亮一階 */',
    '@media (max-width:1099px){',
    '  :root[data-shell="dsh"] #tbList{background:var(--dsh-color-hover);color:var(--fg2);box-shadow:inset 0 0 0 .5px var(--line-strong)}',
    '  :root[data-shell="dsh"] .app.toc-open #tbList{background:var(--dsh-color-module);color:var(--fg)}',
    '  :root[data-shell="dsh"] .app.toc-overlay .dsh-right{border-radius:var(--dsh-radius-lg) 0 0 var(--dsh-radius-lg)}',
    '}',
    '',
    '/* ④ 一條垂直軸：正文欄寬 = 輸入卡內寬 */',
    ':root[data-shell="dsh"] .thread{max-width:calc(var(--dsh-content-w,680px) + var(--dsh-card-extra,32px));padding:12px var(--dsh-clearance,16px) 8px}',
    '',
    '/* ⑤ 頂欄：標題比正文大一階（16/24/500）；分頁左緣對回 20px 基準 */',
    ':root[data-shell="dsh"] .topbar .crumb{font-size:16px;line-height:24px;font-weight:500;color:var(--fg);letter-spacing:0}',
    ':root[data-shell="dsh"] .topbar .crumb b{font-weight:500}',
    ':root[data-shell="dsh"] .head-tabs{padding-left:0}',
    ':root[data-shell="dsh"] .head-tab{font-weight:400}',
    ':root[data-shell="dsh"] .head-tab.on{font-weight:500}',
    '',
    '/* ⑥ 小字收成一階：12/16 */',
    ':root[data-shell="dsh"] .side-count,:root[data-shell="dsh"] .side-region-head,:root[data-shell="dsh"] .dsh-right .toc-count,',
    ':root[data-shell="dsh"] .meta,:root[data-shell="dsh"] .step,:root[data-shell="dsh"] .toolres,:root[data-shell="dsh"] .statusbar,',
    ':root[data-shell="dsh"] .composer .box-foot > span,:root[data-shell="dsh"] .composer .box-foot-r{font-size:12px;line-height:16px}',
    '',
    '/* ⑦ 段落節奏：段距 16（行高 24 的 2/3）、尾註上 8 下 16 */',
    ':root[data-shell="dsh"] .p{margin-bottom:16px;letter-spacing:0}',
    ':root[data-shell="dsh"] .meta{margin:8px 0 16px}',
    ':root[data-shell="dsh"] .turn.user{margin:16px 0 8px}',
    '',
    '/* ⑧ 圖示軌：收合鈕別再被裁（18+4+20=42 ≤ 44）；主鍵給底、次鍵退色 */',
    ':root[data-shell="dsh"] .app.side-rail .side-brand{gap:4px}',
    ':root[data-shell="dsh"] .app.side-rail .side-brand .ghost.icon{width:20px;height:20px}',
    ':root[data-shell="dsh"] .app.side-rail .sa-new{background:var(--dsh-color-elevated);box-shadow:inset 0 0 0 .5px var(--line-strong)}',
    ':root[data-shell="dsh"] .app.side-rail .side-actions .sa{color:var(--fg3)}',
    '',
    '/* ⑨ 圖示一個粗細：16px 用 1.6；12px 放大鏡補到 1.8（光學補償） */',
    ':root[data-shell="dsh"] .side svg *,:root[data-shell="dsh"] .topbar svg *,:root[data-shell="dsh"] .dsh-right svg *,',
    ':root[data-shell="dsh"] .composer svg *,:root[data-shell="dsh"] .statusbar svg *{stroke-width:1.6}',
    ':root[data-shell="dsh"] .dsh-right .find svg *{stroke-width:1.8}',
    '',
    '/* ⑩ 輸入卡：補實邊＋頂部高光，28 圓角才有形狀 */',
    ':root[data-shell="dsh"] .composer .box{box-shadow:inset 0 1px 0 color-mix(in srgb,var(--fg) 7%,transparent),0 0 0 .5px var(--line-strong),0 10px 30px -18px rgba(0,0,0,.55);transition:box-shadow var(--dsh-dur-fast) var(--dsh-ease)}',
    ':root[data-shell="dsh"] .composer .box:focus-within{box-shadow:inset 0 1px 0 color-mix(in srgb,var(--fg) 7%,transparent),0 0 0 1px color-mix(in srgb,var(--acc) 55%,transparent),0 12px 34px -18px rgba(0,0,0,.6)}',
    '',
    '/* ⑪ 底部一列：圖示群 4 貼緊；文字標籤 8 分隔、退成 fg2 */',
    ':root[data-shell="dsh"] .composer .box-line{gap:4px}',
    ':root[data-shell="dsh"] .composer #input{padding-left:4px}',
    ':root[data-shell="dsh"] .composer .box-foot-r{margin-left:auto;padding-left:8px;color:var(--fg2);font-variant-numeric:tabular-nums}',
    '',
    '/* ⑫ 狀態列：只有「章節位置」是給人看的，其餘退成背景 */',
    ':root[data-shell="dsh"] .statusbar{gap:0;padding:0 8px;letter-spacing:0}',
    ':root[data-shell="dsh"] .statusbar .sb-item{padding:0 8px}',
    ':root[data-shell="dsh"] .statusbar .sb-r{gap:0}',
    ':root[data-shell="dsh"] .statusbar #sbChapter{color:var(--fg);font-weight:500}',
    '',
    '/* ⑬ 圓角：取消 3px 與 999px 兩個例外，只留 4/8/12/16/20/28 */',
    ':root[data-shell="dsh"] .composer .box-foot kbd,:root[data-shell="dsh"] .dsh-right .find kbd{border-radius:4px}',
    ':root[data-shell="dsh"] .topbar .pill{border-radius:8px}',
    '',
    '/* ⑭ 顏色紀律：一個紅、一個綠（值不動，只統一來源）；琥珀只留給警告 */',
    ':root[data-shell="dsh"] .statusbar .del,:root[data-shell="dsh"] .cc-del,:root[data-shell="dsh"] .ctx-row.danger{color:color-mix(in srgb,#e06b6b 82%,var(--fg))}',
    ':root[data-shell="dsh"] .add,:root[data-shell="dsh"] .cc-add{color:color-mix(in srgb,var(--ok) 78%,var(--fg))}',
    ':root[data-shell="dsh"] .tool .fn{color:color-mix(in srgb,var(--acc2) 70%,var(--fg3))}',
    '',
    '/* ⑮ hover／選取（時長對齊 --dsh-dur-fast） */',
    ':root[data-shell="dsh"] .side-actions .sa,:root[data-shell="dsh"] .sr-row,:root[data-shell="dsh"] .dsh-right .ch,',
    ':root[data-shell="dsh"] .head-tab,:root[data-shell="dsh"] .topbar .tb-btn,:root[data-shell="dsh"] .composer .hint-btn{transition:background-color var(--dsh-dur-fast) var(--dsh-ease),color var(--dsh-dur-fast) var(--dsh-ease),border-color var(--dsh-dur-fast) var(--dsh-ease),transform var(--dsh-dur-fast) var(--dsh-ease)}',
    ':root[data-shell="dsh"] ::selection{background:color-mix(in srgb,var(--acc) 26%,transparent)}',
    '',
    '@media (prefers-reduced-motion: reduce){',
    '  :root[data-shell="dsh"] *{transition-duration:.001ms !important;animation-duration:.001ms !important}',
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(p, css, 'utf8');
  n++; console.log('· ui/taste.css 換成提案版');
}

/* ② 修根因：產生器把 --dsh-side-pad 的內層變數換成實際值 */
{
  const p = path.join(ROOT, 'tools', 'dsh-tokens.js');
  let s = fs.readFileSync(p, 'utf8');
  const a = "emit(`  --dsh-side-pad:${g('sidebar', 'padding')};`);";
  const b = "emit(`  --dsh-side-pad:${String(g('sidebar', 'padding')).replace('var(--dsh-sidebar-inline-padding)', String(px('sidebar', 'inlinePadding')) + 'px')};`);";
  if (s.includes(a)) { s = s.split(a).join(b); fs.writeFileSync(p, s, 'utf8'); n++; console.log('· dsh-tokens.js：--dsh-side-pad 改成代入實際值'); }
  else console.log('  ! 找不到 side-pad 產生行');
}

console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
