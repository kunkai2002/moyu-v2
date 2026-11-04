// 修手機寬度兩個問題（mirror 回報）
//   ① layout.js 的 <760px 抽屜 media query 在 DSH 外殼也會生效，
//      把 56px 圖示軌推到畫面左邊外（left:-56.6）→ 限定只作用在非 DSH 外殼
//   ② 390px 時狀態列塞不下，右邊兩項被切掉 → 窄寬度只留「章節位置」與 tok
//   node tools/patch-narrow-fix.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let changed = 0;

/* ① layout.js：抽屜只給非 DSH */
{
  const p = path.join(ROOT, 'ui', 'layout.js');
  let s = fs.readFileSync(p, 'utf8');
  const a = "    '  .side{position:absolute;left:0;top:0;bottom:0;width:min(86vw,var(--side-w));',";
  const b = "    '  html:not([data-shell=\"dsh\"]) .side{position:absolute;left:0;top:0;bottom:0;width:min(86vw,var(--side-w));',";
  if (s.includes(a)) { s = s.split(a).join(b); changed++; fs.writeFileSync(p, s, 'utf8'); console.log('✅ ui/layout.js：抽屜 media query 限定非 DSH 外殼'); }
  else if (s.includes(b)) console.log('· ui/layout.js 已是修好的版本');
  else console.log('❌ ui/layout.js 找不到抽屜規則，沒有改');
}

/* ② theme.css：窄寬度狀態列只留必要項 */
{
  const p = path.join(ROOT, 'ui', 'theme.css');
  let s = fs.readFileSync(p, 'utf8');
  const MARK = '/* ── 窄寬度：狀態列只留章節位置與 tok（其他偽裝資訊讓位）── */';
  if (s.includes(MARK)) { console.log('· theme.css 已有窄寬度狀態列規則'); }
  else {
    const block = [
      '',
      MARK,
      '@media (max-width:1023px){',
      '  [data-shell="dsh"] .statusbar{gap:10px;padding:0 10px;overflow:hidden}',
      '  [data-shell="dsh"] .statusbar .sb-item:not(#sbChapter):not(#sbTok):not(.branch),',
      '  [data-shell="dsh"] .statusbar .sb-r .sb-item:nth-child(n+2){display:none}',
      '  [data-shell="dsh"] .statusbar .sb-r{margin-left:auto}',
      '}',
      '',
    ].join('\n');
    s = s.trimEnd() + '\n' + block;
    fs.writeFileSync(p, s, 'utf8');
    changed++;
    console.log('✅ ui/theme.css：窄寬度狀態列規則');
  }
}

console.log(changed ? '完成（改 ' + changed + ' 個檔）' : '沒有需要改的');
