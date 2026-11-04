// 把 ui/theme.css 的 DSH 段改成「讀 ui/dsh-tokens.css 的真值」，並加上 DSH 三欄外殼
//
//   node tools/patch-dsh-shell.js          套用（會先備份 theme.css）
//   node tools/patch-dsh-shell.js --check   只檢查現在是不是新版（不寫檔）
//
// 為什麼要腳本：theme.css 是 UTF-8 大字串，用 PowerShell 改會亂碼（MEMORY 第 20 條）。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS = path.join(ROOT, 'ui', 'theme.css');
const BACKUP_DIR = 'D:/kun-workspace/backup';
const MARK_START = '/* ══════════════════════════════════════════════════════════════\n   主題 7 ── DeepSeek Harness（DSH）';
const MARK_END = '/* ══════════════════════════════════════════════════════════════\n   主題 8 ── DeepSeek Harness 淺色';
const NEW_MARK = '/* ═══ DSH 外殼（真值版）═══ */';

const legacy = fs.readFileSync(CSS, 'utf8');

if (process.argv.includes('--check')) {
  const ok = legacy.includes(NEW_MARK) && !legacy.includes('248px');
  console.log(ok ? '✅ theme.css 已是真值版' : '❌ theme.css 還是舊的近似值版（248px / 46px）');
  process.exit(ok ? 0 : 1);
}

/* ── 新內容 ─────────────────────────────────────────────── */
const DSH_THEME = `/* ══════════════════════════════════════════════════════════════
   主題 7 ── DeepSeek Harness（DSH）
   顏色與尺寸**全部**來自 ui/dsh-tokens.css（由 docs/DSH-真值.json 產生，
   真值再從 E:\\DeepSeek\\resources\\app.asar 的 @deepseek-ai/dsh-client-ui-* 抽出來）。
   這裡不准出現手寫的 px 數字；要改數字就改真值檔再重跑：
     node tools/dsh-truth.js && node tools/dsh-tokens.js
   ══════════════════════════════════════════════════════════════ */
:root[data-theme="dsh"]{
  --bg:var(--dsh-color-bg); --bg-side:var(--dsh-color-sidebar-fill);
  --bg-elev:var(--dsh-color-bg-elev); --sel:var(--dsh-color-sel);
  --line:var(--dsh-color-line); --line-strong:var(--dsh-color-line-strong);
  --fg:var(--dsh-color-fg); --fg2:var(--dsh-color-fg2); --fg3:var(--dsh-color-fg3);
  --acc:var(--dsh-color-acc); --acc2:#f59e0b; --ok:#4ed17e; --hl:#1e2f52;
  --status-bg:transparent; --status-fg:var(--dsh-color-fg3);
  --radius:var(--dsh-radius-md);
  --text-font:var(--dsh-font); --ui-font:var(--dsh-font);
  --fs:var(--dsh-content-size); --lh:1.714;
  --side-w:var(--dsh-sidebar-w);
}
:root[data-theme="dsh-light"]{
  --bg:var(--dsh-color-bg); --bg-side:var(--dsh-color-sidebar-fill);
  --bg-elev:var(--dsh-color-bg-elev); --sel:var(--dsh-color-sel);
  --line:var(--dsh-color-line); --line-strong:var(--dsh-color-line-strong);
  --fg:var(--dsh-color-fg); --fg2:var(--dsh-color-fg2); --fg3:var(--dsh-color-fg3);
  --acc:var(--dsh-color-acc); --acc2:#b45309; --ok:#16a34a; --hl:#dbeafe;
  --status-bg:transparent; --status-fg:var(--dsh-color-fg3);
  --radius:var(--dsh-radius-md);
  --text-font:var(--dsh-font); --ui-font:var(--dsh-font);
  --fs:var(--dsh-content-size); --lh:1.714;
  --side-w:var(--dsh-sidebar-w);
}

/* 正文：真值 14px / 24px（--dsw-font-markdown-base） */
:root[data-theme="dsh"] .p,
:root[data-theme="dsh-light"] .p{
  font-size:var(--dsh-content-size);line-height:var(--dsh-content-lh);
  text-align:left;margin-bottom:12px;letter-spacing:.1px;
}
:root[data-theme="dsh"] .thread,
:root[data-theme="dsh-light"] .thread{max-width:var(--dsh-content-max);padding:20px 0 10px}
:root[data-theme="dsh"] .turn.ai .gutter,
:root[data-theme="dsh-light"] .turn.ai .gutter{display:none}
:root[data-theme="dsh"] .who,
:root[data-theme="dsh-light"] .who{display:none}
:root[data-theme="dsh"] .turn.ai .b,
:root[data-theme="dsh-light"] .turn.ai .b{padding-left:0}
:root[data-theme="dsh"] .turn.user{margin:16px 0 8px}
:root[data-theme="dsh"] .turn.user .bubble{
  background:var(--dsh-color-bg-elev);border:0;border-radius:var(--dsh-radius-xl);
  padding:10px 16px;max-width:min(525px,82%);
  font-size:var(--dsh-content-size);line-height:calc(var(--dsh-content-size) + 10px);color:var(--dsh-color-fg);
}
:root[data-theme="dsh"] .meta{font-size:12px;margin:6px 0 18px}
:root[data-theme="dsh"] .step{font-size:12.5px;margin:14px 0 10px}
:root[data-theme="dsh"] .step .st-run{border-top-color:var(--acc)}

/* 面板／選單：圓角一律用真值代幣 */
:root[data-theme="dsh"] .panel,
:root[data-theme="dsh"] .marks-panel,
:root[data-theme="dsh"] .stats-panel,
:root[data-theme="dsh"] .hist-panel,
:root[data-theme="dsh"] .phone-panel,
:root[data-theme="dsh"] .detail,
:root[data-theme="dsh"] .overflow,
:root[data-theme="dsh"] .ctx,
:root[data-theme="dsh"] .theme-menu{
  border-radius:var(--dsh-radius-md);border-color:var(--dsh-color-border-l2);
  background:var(--dsh-color-bg-elev);
}
:root[data-theme="dsh"] .panel-head{font-size:13px;color:var(--fg);border-bottom:.5px solid var(--line)}
:root[data-theme="dsh"] .panel .btn,
:root[data-theme="dsh"] .panel select{border-radius:var(--dsh-radius-sm);background:var(--sel);border-color:var(--dsh-color-border-l2);color:var(--fg)}
:root[data-theme="dsh"] .tb-btn,
:root[data-theme="dsh"] .pill,
:root[data-theme="dsh"] .hint-btn,
:root[data-theme="dsh"] .ov-row,
:root[data-theme="dsh"] .ctx-row,
:root[data-theme="dsh"] .tm-item{border-radius:var(--dsh-radius-sm)}
:root[data-theme="dsh"] .tb-btn:hover,
:root[data-theme="dsh"] .ov-row:hover,
:root[data-theme="dsh"] .ctx-row:hover{background:var(--dsh-color-hover)}

/* 首頁／引導卡 */
:root[data-theme="dsh"] .home{max-width:var(--dsh-content-max)}
:root[data-theme="dsh"] .home-h{font-size:17px;letter-spacing:0;color:var(--fg)}
:root[data-theme="dsh"] .home-sub{font-size:13px;color:var(--fg3)}
:root[data-theme="dsh"] .home-card,
:root[data-theme="dsh"] .ob-step{background:var(--dsh-color-bg-elev);border:.5px solid var(--dsh-color-border-l2);border-radius:var(--dsh-radius-md)}
:root[data-theme="dsh"] .home-book{background:var(--dsh-color-bg-elev);border:.5px solid var(--line);border-radius:var(--dsh-radius-sm)}
:root[data-theme="dsh"] .home-act{border-radius:var(--dsh-radius-sm);background:var(--dsh-color-bg-elev);border-color:var(--dsh-color-border-l2)}
:root[data-theme="dsh"] .home-sec{color:var(--fg3);letter-spacing:.2px;text-transform:none;font-size:12px}
:root[data-theme="dsh"] .home-row{border-radius:var(--dsh-radius-sm);font-size:13px}
:root[data-theme="dsh"] .home-row:hover{background:var(--dsh-color-hover)}

`;

const DSH_SHELL = `
/* ══════════════════════════════════════════════════════════════
   DSH 外殼（真值版）── 三欄：側欄（280）｜中欄｜右欄目錄
   所有數字都是 ui/dsh-tokens.css 的 --dsh-*；沒有任何手寫 px。
   ══════════════════════════════════════════════════════════════ */
[data-shell="dsh"] .app{display:flex;align-items:stretch}

/* ── 側欄：6px 12px 內距、右緣 .5px、字 14px ── */
[data-shell="dsh"] .side{
  width:var(--dsh-col-side,var(--dsh-sidebar-w));flex:none;min-width:0;
  box-sizing:border-box;padding:var(--dsh-side-pad);
  background:var(--bg-side);color:var(--fg);
  border-right:.5px solid var(--line-strong);
  font-size:var(--dsh-side-font);
}
[data-shell="dsh"] .side-top{
  flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;
  height:var(--dsh-topstrip-h);box-sizing:border-box;padding:0 var(--dsh-side-inline) 2px;
  margin:calc(-1 * 6px) calc(-1 * var(--dsh-side-inline)) 0;
}
[data-shell="dsh"] .side-top .ghost.icon{width:var(--dsh-icon);height:var(--dsh-icon)}
[data-shell="dsh"] .side-count{font-size:11px;color:var(--fg3);margin-right:auto;padding-left:2px;font-variant-numeric:tabular-nums}

/* ── 品牌列（工作區名＝書名）：60px、18px/24px、600 ── */
[data-shell="dsh"] .side-brand{
  flex:none;display:flex;align-items:center;gap:var(--dsh-logo-gap);
  height:var(--dsh-logo-h);box-sizing:border-box;
  padding:8px 0 8px 4px;margin-bottom:4px;overflow:hidden;
}
[data-shell="dsh"] .brand-mark{display:inline-flex;align-items:center;color:var(--fg2)}
[data-shell="dsh"] .brand-mark svg{width:20px;height:20px}
[data-shell="dsh"] .brand-name{
  flex:1;min-width:0;display:block;text-align:left;
  height:var(--dsh-brand-h);line-height:var(--dsh-brand-lh);
  font-size:var(--dsh-brand-size);font-weight:var(--dsh-brand-weight);letter-spacing:.04em;
  color:var(--fg);background:none;border:0;cursor:pointer;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0;
}
[data-shell="dsh"] .side-brand .ghost.icon{width:var(--dsh-icon);height:var(--dsh-icon)}

/* ── 新對話（＝書架）：38px、圓角 12、.5px 框 ── */
[data-shell="dsh"] .sa-new{
  flex:none;box-sizing:border-box;width:auto;
  height:var(--dsh-new-h);margin:var(--dsh-new-margin);padding:var(--dsh-new-pad);
  border:var(--dsh-new-border);border-radius:var(--dsh-radius-md);
  background:var(--dsh-color-elevated);color:var(--fg);
  font-size:var(--dsh-new-size);font-weight:var(--dsh-new-weight);line-height:var(--dsh-new-lh);
  display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;
}
[data-shell="dsh"] .sa-new:hover{background:var(--dsh-color-float-hover)}
[data-shell="dsh"] .sa-new svg{width:16px;height:16px;flex:none}

/* ── 面板列（插件／自動化任務／更多）：36px、7px 8px、圓角 12 ── */
[data-shell="dsh"] .side-actions{
  flex:none;display:flex;flex-direction:column;
  gap:var(--dsh-panels-gap);margin-bottom:var(--dsh-panels-mb);padding:0;
}
[data-shell="dsh"] .side-actions .sa{
  box-sizing:border-box;flex:none;width:auto;
  min-height:var(--dsh-row-h);height:var(--dsh-row-h);
  margin:var(--dsh-row-margin);padding:var(--dsh-row-pad);
  gap:var(--dsh-row-gap);border-radius:var(--dsh-radius-md);
  line-height:var(--dsh-row-lh);font-size:var(--dsh-side-font);
  color:var(--fg);background:none;border:0;
  display:flex;align-items:center;text-align:left;cursor:pointer;
}
[data-shell="dsh"] .side-actions .sa:hover{background:var(--dsh-color-hover)}
[data-shell="dsh"] .side-actions .sa svg{width:16px;height:16px;flex:none;color:var(--fg3)}
[data-shell="dsh"] .side-actions .sa:hover svg{color:var(--fg2)}

/* ── 最近（最近的會話＝最近讀過的書）── */
[data-shell="dsh"] .side-region{
  flex:1;min-height:0;display:flex;flex-direction:column;
  margin-left:-4px;margin-right:calc(-1 * var(--dsh-side-inline));padding-left:4px;overflow:hidden;
}
[data-shell="dsh"] .side-region-head{
  flex:none;display:flex;align-items:center;gap:6px;
  padding:8px 2px 6px;color:var(--fg3);font-size:12px;letter-spacing:.02em;
}
[data-shell="dsh"] .side-recent{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
  scrollbar-width:thin;scrollbar-color:var(--line) transparent}
[data-shell="dsh"] .sr-row{
  box-sizing:border-box;display:flex;align-items:center;gap:8px;
  width:100%;min-height:var(--dsh-row-h);padding:var(--dsh-row-pad);
  margin:0 0 1px;border:0;border-radius:var(--dsh-radius-md);
  background:none;color:var(--fg2);font:inherit;font-size:13px;line-height:var(--dsh-row-lh);
  text-align:left;cursor:pointer;
}
[data-shell="dsh"] .sr-row:hover{background:var(--dsh-color-hover);color:var(--fg)}
[data-shell="dsh"] .sr-row.on{background:var(--sel);color:var(--fg)}
[data-shell="dsh"] .sr-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-shell="dsh"] .sr-p{flex:none;font-size:11.5px;color:var(--fg3);font-variant-numeric:tabular-nums}
[data-shell="dsh"] .side-empty{padding:10px 8px;color:var(--fg3);font-size:12.5px}

/* ── 底部登錄／設置列 ── */
[data-shell="dsh"] .side-foot{flex:none;padding:6px 0 2px;border-top:0}
[data-shell="dsh"] .side-foot .me{
  width:100%;min-height:var(--dsh-row-h);padding:var(--dsh-row-pad);
  border-radius:var(--dsh-radius-md);font-size:12.5px;color:var(--fg2);
}
[data-shell="dsh"] .side-foot .me:hover{background:var(--dsh-color-hover)}
[data-shell="dsh"] .side-foot .av{width:20px;height:20px;border-radius:var(--dsh-radius-xs);background:var(--sel);color:var(--fg2);font-size:10.5px}

/* ── 頂欄：min-height 76、padding 10 28 0 20、下框 .5px ── */
[data-shell="dsh"] .topbar{
  box-sizing:border-box;height:auto;min-height:var(--dsh-head-h);
  padding:var(--dsh-head-pad);gap:var(--dsh-head-gap);
  border-bottom:.5px solid var(--line-strong);
  display:grid;grid-template-columns:auto minmax(0,1fr) auto;
  align-content:start;align-items:center;
}
[data-shell="dsh"] .topbar .crumb{
  min-height:30px;display:flex;align-items:center;
  font-size:13px;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-shell="dsh"] .topbar-r{display:flex;align-items:center;gap:8px;margin-left:var(--dsh-head-utils-ml);grid-column:3}
[data-shell="dsh"] .head-tabs{
  grid-column:1/-1;display:flex;flex-wrap:wrap;gap:16px 20px;
  min-width:0;margin-top:10px;padding-left:8px;
}
[data-shell="dsh"] .head-tab{
  position:relative;min-height:25px;padding:0 0 9px;border:0;background:none;
  color:var(--fg3);font-size:13px;font-weight:500;line-height:16px;cursor:pointer;
}
[data-shell="dsh"] .head-tab:after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:0 0;
}
[data-shell="dsh"] .head-tab.on{color:var(--acc)}
[data-shell="dsh"] .head-tab.on:after{background:var(--acc)}
[data-shell="cc"] .head-tabs{display:none}
[data-shell="dsh"] .tb-nav{display:flex;gap:2px;flex:none;grid-column:1}
[data-shell="dsh"] .tb-btn{width:var(--dsh-icon);height:var(--dsh-icon);border-radius:var(--dsh-radius-sm)}

/* ── 中欄：內容寬 680–920（64%）、輸入卡片 28 圓角 ── */
[data-shell="dsh"] .stream{padding:0 var(--dsh-clearance)}
[data-shell="dsh"] .composer{
  box-sizing:border-box;width:100%;
  max-width:calc(var(--dsh-content-w,var(--dsh-content-max)) + var(--dsh-card-extra));
  padding:0 var(--dsh-clearance) 10px;
}
[data-shell="dsh"] .composer .box{
  border-radius:var(--dsh-card-r);
  background:var(--dsh-color-input);
  border:0;
  box-shadow:0 6px 24px rgba(0,0,0,.18);
  padding-top:var(--dsh-card-pad-top);padding-left:0;padding-right:0;
  gap:var(--dsh-card-gap);display:flex;flex-direction:column;
}
[data-shell="dsh"] .composer .box-line{padding:0 8px 0 14px}
[data-shell="dsh"] #input{
  box-sizing:border-box;min-height:var(--dsh-input-h);
  padding:var(--dsh-input-pad);margin:0;
  font-size:var(--dsh-content-size);line-height:var(--dsh-content-lh);
}
[data-shell="dsh"] .composer .box-foot{padding:0 12px 8px;color:var(--dsh-color-caption);font-size:11.5px}
[data-shell="dsh"] .cn-btn{width:var(--dsh-icon);height:var(--dsh-icon);border-radius:var(--dsh-radius-panel)}
[data-shell="dsh"] .cn-pos{font-size:12px;color:var(--fg3);min-width:72px}

/* ── 右欄：目錄（點章跳章）── */
.dsh-right{
  flex:none;width:var(--dsh-col-right,300px);min-width:0;
  box-sizing:border-box;display:flex;flex-direction:column;
  background:var(--bg);border-left:.5px solid var(--line-strong);
}
.dsh-right .panel-head{
  flex:none;display:flex;align-items:center;gap:8px;
  height:var(--dsh-topstrip-h,52px);padding:0 12px;
  border-bottom:.5px solid var(--line);
  font-size:13px;color:var(--fg);
}
.dsh-right .toc-count{margin-left:auto;font-size:11.5px;color:var(--fg3);font-variant-numeric:tabular-nums}
.dsh-right .find{
  flex:none;margin:8px 12px 4px;gap:7px;padding:5px 8px;
  border:.5px solid var(--line-strong);border-radius:var(--dsh-radius-sm);
  background:var(--dsh-color-input);color:var(--fg3);font-size:12px;
}
.dsh-right .find input{flex:1;min-width:0;border:0;background:none;color:var(--fg);font:inherit;outline:none}
.dsh-right .find svg{width:12px;height:12px;flex:none;opacity:.75}
.dsh-right .find kbd{margin-left:auto;border:0;color:var(--fg3);font-size:10px;padding:0}
.dsh-right .tree{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:4px 6px 10px}
[data-shell="dsh"] .dsh-right .tree{display:block}
.dsh-right .ch{
  box-sizing:border-box;display:flex;align-items:center;gap:8px;
  min-height:var(--dsh-row-h);padding:var(--dsh-row-pad);
  border-radius:var(--dsh-radius-md);font-size:13px;line-height:var(--dsh-row-lh);
  color:var(--fg2);cursor:pointer;
}
.dsh-right .ch:hover{background:var(--dsh-color-hover);color:var(--fg)}
.dsh-right .ch.on{background:var(--sel);color:var(--fg)}
.dsh-right .vol{padding:10px 8px 4px;color:var(--fg3);font-size:11.5px}

/* ── 收合狀態：rail（56px 圖示軌）／toc-collapsed ── */
[data-shell="dsh"] .app.rail .side{padding:18px 6px 6px;width:var(--dsh-col-side,var(--dsh-rail-w))}
[data-shell="dsh"] .app.rail .side-top{height:0;margin:0;padding:0;overflow:hidden}
[data-shell="dsh"] .app.rail .side-brand{height:36px;margin-bottom:12px;padding:0;justify-content:flex-start}
[data-shell="dsh"] .app.rail .brand-name,
[data-shell="dsh"] .app.rail .side-actions .sa span,
[data-shell="dsh"] .app.rail .sa-new span,
[data-shell="dsh"] .app.rail .side-region,
[data-shell="dsh"] .app.rail .side-foot .me-txt,
[data-shell="dsh"] .app.rail .side-foot .me-pct{display:none}
[data-shell="dsh"] .app.rail .sa-new,
[data-shell="dsh"] .app.rail .side-actions .sa{
  width:36px;height:36px;min-height:36px;margin:0 0 12px;padding:0;
  border-color:transparent;background:none;justify-content:center;
}
[data-shell="dsh"] .app.rail .side-actions{gap:12px;margin-bottom:12px}
[data-shell="dsh"] .app.rail .side-foot .me{justify-content:center}
[data-shell="dsh"] .app.toc-collapsed .dsh-right{display:none}

/* ── 原文視圖（對話／原文 tab 的「原文」）── */
.src-view{
  flex:1;min-height:0;margin:0;padding:16px calc(var(--dsh-clearance,16px) + 4px);
  overflow:auto;white-space:pre-wrap;word-break:break-word;
  font-family:var(--dsh-font-code);font-size:calc(var(--dsh-content-size) - 1px);
  line-height:1.7;color:var(--fg2);background:var(--bg);
}
.src-view[hidden]{display:none}
`;

/* ── 備份然後套用 ─────────────────────────────────────────── */
if (!legacy.includes(MARK_START) || !legacy.includes(MARK_END)) {
  console.error('❌ theme.css 找不到主題 7／主題 8 的分界，沒有動檔');
  process.exit(1);
}
const start = legacy.indexOf(MARK_START);
const end = legacy.indexOf(MARK_END);

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const bak = path.join(BACKUP_DIR, `theme_${stamp}.css`);
fs.writeFileSync(bak, legacy, 'utf8');

let next = legacy.slice(0, start) + DSH_THEME + legacy.slice(end);
// 舊的 DSH 外殼近似值段落（如果還在）整段換掉
if (next.includes(NEW_MARK)) {
  const i = next.indexOf(NEW_MARK);
  next = next.slice(0, i) + NEW_MARK + next.slice(i + NEW_MARK.length);
} else {
  next = next.trimEnd() + '\n\n' + NEW_MARK + DSH_SHELL;
}
fs.writeFileSync(CSS, next, 'utf8');
console.log('✅ theme.css 套用真值版 · 備份：' + bak);
