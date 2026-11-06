// 版面策略調整（JOJO 2026-11-06）：
//   · 側欄不再自動縮成 56px 圖示軌（他抱怨「只有圖示、沒有文字又沒作用」）：
//     一律保留完整側欄；只有視窗 <900 才變成「可展開的抽屜」（有文字）
//   · 目錄（#tocPanel）：≥1100 dock 在右側；<1100 是抽屜（預設收，用頂欄目錄鍵開）
//   node tools/patch-layout-policy.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ① shell-dsh.js 的 layoutPass */
{
  const p = path.join(ROOT, 'ui', 'shell-dsh.js');
  let s = fs.readFileSync(p, 'utf8');
  const a1 = s.indexOf('  function layoutPass() {');
  const a2 = s.indexOf('  function boot() {', a1);
  if (a1 < 0 || a2 < 0) { console.error('❌ 找不到 layoutPass'); process.exit(1); }
  const fn = [
    '  function layoutPass() {',
    '    var app = document.querySelector(\'.app\');',
    '    if (!app) return;',
    '    var vw = window.innerWidth;',
    '    var railWanted = app.dataset.rail === \'1\';          // 只有使用者自己按收合才變軌',
    '    var overlaySide = vw < 900;                          // <900：側欄是抽屜（一樣有文字）',
    '    var s = railWanted ? num(\'--dsh-rail-w\', 56)',
    '      : clamp(num(\'--dsh-sidebar-w\', 280), num(\'--dsh-sidebar-min\', 264), num(\'--dsh-sidebar-max\', 420));',
    '    // 目錄：>=1100 dock，<1100 抽屜（不佔中欄寬度）',
    '    var dockToc = vw >= 1100 && app.dataset.toc !== \'0\';',
    '    var r = dockToc ? num(\'--dsh-right-min\', 300) : 0;',
    '    var center = Math.max(0, vw - s - r);',
    '    var content = clamp(num(\'--dsh-content-ratio\', 0.64) * center,',
    '      num(\'--dsh-content-min\', 680), num(\'--dsh-content-max\', 920));',
    '',
    '    app.classList.toggle(\'side-rail\', railWanted);',
    '    app.classList.toggle(\'side-overlay\', overlaySide && !railWanted);',
    '    app.classList.toggle(\'toc-overlay\', !dockToc && vw < 1100);',
    '    app.classList.toggle(\'toc-collapsed\', !dockToc && vw >= 1100);',
    '    if (vw >= 1100) app.classList.remove(\'toc-open\');',
    '    app.style.setProperty(\'--dsh-col-side\', s + \'px\');',
    '    app.style.setProperty(\'--dsh-col-right\', r + \'px\');',
    '    app.style.setProperty(\'--dsh-content-w\', content + \'px\');',
    '  }',
    '  window.__moyuLayoutPass = layoutPass;',
    '',
  ].join('\n');
  s = s.slice(0, a1) + fn + s.slice(a2);
  fs.writeFileSync(p, s, 'utf8');
  console.log('· shell-dsh.js：layoutPass 改成「完整側欄 + 目錄 dock/抽屜」');
}

/* ② CSS：抽屜樣式（追加在最末，優先權最高） */
{
  const p = path.join(ROOT, 'ui', 'dsh-polish-3.css');
  let s = fs.readFileSync(p, 'utf8');
  const MARK = '/* ── 版面策略：完整側欄 + 目錄抽屜（2026-11-06）';
  if (!s.includes(MARK)) {
    s += [
      '',
      MARK + ' ─────────────────────────────── */',
      '/* 側欄：<900 時是「有文字」的抽屜，不是圖示軌 */',
      ':root[data-shell="dsh"] .app.side-overlay .side{',
      '  position:absolute;top:0;bottom:0;left:0;z-index:40;',
      '  transform:translateX(-101%);visibility:hidden;',
      '  transition:transform var(--dsh-dur) var(--dsh-ease), visibility 0s linear var(--dsh-dur);',
      '  box-shadow:14px 0 40px -18px rgba(0,0,0,.5);',
      '}',
      ':root[data-shell="dsh"] .app.side-overlay.side-open .side{',
      '  transform:none;visibility:visible;',
      '  transition:transform var(--dsh-dur) var(--dsh-ease), visibility 0s;',
      '}',
      '/* 目錄：<1100 是右側抽屜 */',
      ':root[data-shell="dsh"] .app.toc-overlay .dsh-right{',
      '  position:absolute;top:0;right:0;bottom:0;z-index:35;width:min(86vw,320px);',
      '  transform:translateX(101%);visibility:hidden;',
      '  transition:transform var(--dsh-dur) var(--dsh-ease), visibility 0s linear var(--dsh-dur);',
      '  box-shadow:-18px 0 48px -24px rgba(0,0,0,.55);',
      '}',
      ':root[data-shell="dsh"] .app.toc-overlay.toc-open .dsh-right{',
      '  transform:none;visibility:visible;',
      '  transition:transform var(--dsh-dur) var(--dsh-ease), visibility 0s;',
      '}',
      ':root[data-shell="dsh"] .app.toc-overlay.toc-open:before{',
      '  content:"";position:fixed;inset:0;z-index:34;',
      '  background:color-mix(in srgb, #000 42%, transparent);',
      '  animation:polish-fade var(--dsh-dur) var(--dsh-ease) both;',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(p, s, 'utf8');
    console.log('· dsh-polish-3.css：抽屜樣式');
  }
}
