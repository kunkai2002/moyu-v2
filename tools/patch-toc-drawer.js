// ① 移除底部翻章列（JOJO：做成抽屜式目錄）
// ② 頂欄那顆「目錄」改成開關右側目錄（寬螢幕＝dock，窄螢幕＝抽屜）
//   node tools/patch-toc-drawer.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'chrome.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

/* ① 翻章列整段拿掉 */
const start = s.indexOf("  /* ── 閱讀頁翻章列 ── */");
const endMarker = '  /* ── 其它接線';
const end = endMarker && s.indexOf(endMarker, start) > 0 ? s.indexOf(endMarker, start) : -1;
if (start > 0 && end > start) {
  s = s.slice(0, start) + s.slice(end);
  n++;
  console.log('· 移除底部翻章列');
} else {
  // 找不到收尾標記：用區塊結尾的特徵退而求其次（到下一段 /* ── 註解）
  const nextComment = s.indexOf('  /* ──', start + 10);
  if (start > 0 && nextComment > start) {
    s = s.slice(0, start) + s.slice(nextComment);
    n++;
    console.log('· 移除底部翻章列（用下一個註解當邊界）');
  } else {
    console.log('  ! 找不到翻章列區塊');
  }
}

/* ② tbList 改成目錄開關 */
const oldBtn = s.slice(s.indexOf("  const listBtn = mk('tbList', 'list', '目錄（開關左側章節）');"), s.indexOf("  const histBtn2 = mk('tbHistory', 'history', '歷史（最近讀過的書）');"));
const newBtn = [
  "  const listBtn = mk('tbList', 'list', '目錄（章節清單）');",
  "  listBtn.addEventListener('click', () => {",
  "    const app = document.querySelector('.app');",
  "    if (!app) return;",
  "    if (window.innerWidth >= 1100) {",
  "      // 寬螢幕：目錄是右側 dock，用 dataset.toc 收合／展開",
  "      app.dataset.toc = app.dataset.toc === '0' ? '1' : '0';",
  "      app.dispatchEvent(new Event('moyu:layout'));",
  "      if (window.__moyuLayoutPass) window.__moyuLayoutPass();",
  "    } else {",
  "      // 窄螢幕：目錄是右側抽屜",
  "      app.classList.toggle('toc-open');",
  "    }",
  "  });",
  "",
].join('\n');
if (oldBtn) { s = s.split(oldBtn).join(newBtn); n++; console.log('· tbList 改成目錄開關（dock／抽屜）'); }
else console.log('  ! 找不到 listBtn 區塊');

fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
