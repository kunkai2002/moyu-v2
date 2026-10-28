// 資訊架構整理：一套入口、不重複
// 左：後退 / 前進 / 首頁（吃掉落子「回書架」）
// 右：目錄 / 標記 / 統計 / 歷史 / 手機 / 老闆鍵 / 設定 / ⋯（下載、書評）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── chrome.js ───────────────────────────────────────────── */
{
  const f = p('ui/chrome.js');
  let s = fs.readFileSync(f, 'utf8');

  // 1) 移除「回書架」：首頁就是書架入口
  if (s.includes("mk('tbShelf'")) {
    s = s.replace(/\s*const homeBtn = mk\('tbShelf'[\s\S]*?bar\.insertBefore\(homeBtn, bar\.firstChild\);\n/, '\n');
    // 上面那行可能沒吃乾淨，用逐段方式再處理
    s = s.replace("  const homeBtn = mk('tbShelf', 'shelf', '回書架 (Esc)');\n", '');
    s = s.replace("  homeBtn.addEventListener('click', () => { D.openShelf(); push(snap()); });\n", '');
    s = s.replace("  bar.insertBefore(homeBtn, bar.firstChild);\n", '');
    console.log('chrome.js: 移除 tbShelf');
  }

  // 2) 老闆鍵回到頂欄（原本被收進溢出）
  if (!s.includes('tbBoss')) {
    must(s, "  const phoneBtn = mk('tbPhone', 'phone', '手機版');", 'chrome phone btn');
    s = s.replace(
      "  const phoneBtn = mk('tbPhone', 'phone', '手機版');",
      "  const bossBtn2 = mk('tbBoss', 'shield', '老闆鍵 (Alt+Q)');\n"
      + "  bossBtn2.addEventListener('click', () => window.__moyuDebug?.boss(true));\n"
      + "  const phoneBtn = mk('tbPhone', 'phone', '手機版');"
    );
    must(s, "  right.appendChild(phoneBtn);", 'chrome append phone');
    s = s.replace("  right.appendChild(phoneBtn);", "  right.appendChild(bossBtn2);\n  right.appendChild(phoneBtn);");
    console.log('chrome.js: 老闆鍵回頂欄');
  }

  // 3) 溢出只留「頂欄沒有的」；重複的直接丟掉
  if (!s.includes('DUP_IN_TOPBAR')) {
    const oldFn = `  function addToOverflow(el) {
    if (!el || el.dataset.moved) return;
    el.dataset.moved = '1';
    // 純圖標按鈕沒有文字，用 title 當名字；真的沒有就跳過（不要出現「功能」這種空殼）
    const raw = (el.textContent || '').trim() || (el.getAttribute('title') || '').trim();
    if (!raw) { el.remove(); return; }
    // 純資訊項（章節 0 這種）不需要進選單
    if (/^章節\\s*\\d+$/.test(raw)) { el.remove(); return; }
    const label = raw;
    if ([...ov.querySelectorAll('.ov-row')].some((r) => r.textContent.trim() === label)) { el.remove(); return; }`;

    must(s, oldFn, 'chrome addToOverflow');

    const newFn = `  /* 頂欄已經有的功能，不要再出現在溢出選單裡 */
  const DUP_IN_TOPBAR = ['最近', '歷史', '統計', '標記', '章節', '書架', '首頁', '手機', '設定', '目錄', '老闆鍵'];

  function addToOverflow(el) {
    if (!el || el.dataset.moved) return;
    el.dataset.moved = '1';
    const raw = (el.textContent || '').trim() || (el.getAttribute('title') || '').trim();
    if (!raw) { el.remove(); return; }
    // 純資訊項（章節 0、已開啟的書數…）不需要進選單
    if (/^章節\\s*\\d+$/.test(raw) || /書數$/.test(raw) || /^已開啟/.test(raw)) { el.remove(); return; }
    // 與頂欄重複 → 移除
    if (DUP_IN_TOPBAR.some((k) => raw.startsWith(k))) { el.remove(); return; }
    const label = raw;
    if ([...ov.querySelectorAll('.ov-row')].some((r) => r.textContent.trim() === label)) { el.remove(); return; }`;

    s = s.replace(oldFn, newFn);
    console.log('chrome.js: 溢出只留獨有項');
  }

  fs.writeFileSync(f, s, 'utf8');
}

/* ── wiring11：不再插「最近」膠囊（歷史抽屜已接手），只保留記錄功能 ── */
{
  const f = p('ui/wiring11.js');
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes("btn.textContent = '最近'")) {
    const start = s.indexOf('  const bar = $(\'.topbar-r\');');
    const end = s.indexOf('})();');
    must(s, "  const bar = $('.topbar-r');", 'wiring11 bar');
    must(s, "})();", 'wiring11 end');
    // 把「插膠囊 + 菜單」整段拿掉，只留 openBook 包裝
    s = s.slice(0, start) + '  // 最近/歷史的 UI 已由 shell.js 的歷史抽屜接手，這裡只負責記下開過的書\n' + s.slice(end);
    fs.writeFileSync(f, s, 'utf8');
    console.log('wiring11.js: 移除重複的「最近」膠囊');
  } else console.log('wiring11.js 已清理');
}

/* ── shell.js：Esc 回首頁（原本是回書架） ────────────────── */
{
  const f = p('ui/shell.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('Esc 回首頁')) {
    must(s, "  window.__moyuShell = { openHome: openHome, toggleHistory: toggleHistory, recentList: recentList };", 'shell export');
    s = s.replace(
      "  window.__moyuShell = { openHome: openHome, toggleHistory: toggleHistory, recentList: recentList };",
      `  /* Esc：沒有其他面板開著時回首頁 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.panel:not([hidden]), .marks-panel:not([hidden]), .stats-panel:not([hidden]), .detail:not([hidden]), .hist-panel:not([hidden]), .phone-panel:not([hidden]), .overflow:not([hidden])');
    if (open) return;
    if (document.body.classList.contains('bossing')) return;
    openHome();
  });

  window.__moyuShell = { openHome: openHome, toggleHistory: toggleHistory, recentList: recentList };`
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('shell.js: Esc 回首頁');
  } else console.log('shell.js 已有 Esc');
}

/* ── phone.js：沒有 sync 能力時也要給人話 ───────────────── */
{
  const f = p('ui/phone.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('這個版本還沒接上同步')) {
    must(s, "      var st = await B.sync.status();", 'phone status');
    s = s.replace(
      "      var st = await B.sync.status();",
      "      if (!B.sync || !B.sync.status) {\n"
      + "        stateEl.textContent = '這個版本還沒接上同步，請更新後再試';\n"
      + "        return;\n"
      + "      }\n"
      + "      var st = await B.sync.status();"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('phone.js: 降級提示');
  } else console.log('phone.js 已有提示');
}
