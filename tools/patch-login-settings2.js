// app.js / chrome.js / wiring.js 的登入與設定改動（CRLF 安全版）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');

/* ── app.js ───────────────────────────────────────────────── */
{
  const f = 'ui/app.js';
  let s = rd(f);
  let lines = s.split(/\r?\n/);
  const eol = s.includes('\r\n') ? '\r\n' : '\n';

  // 1) /login → 掃碼；新增 /settings
  const di = lines.findIndex((l) => /if \(\/\^\\\/login\$\/i\.test\(text\)\) \{ showCookiePrompt\(\); return; \}/.test(l));
  if (di < 0) { console.error('❌ /login 分派找不到'); process.exit(1); }
  lines.splice(di, 1,
    "  if (/^\\/(login|qr)$/i.test(text)) { showLoginPanel(); return; }",
    "  if (/^\\/(settings|set|config)$/i.test(text)) { window.__moyuOpenSettings?.(); return; }");

  // 2) 刪掉「貼 cookie」退路（從 if (!bridge?.qr) { 到對應的 } 再加一個空行）
  const fi = lines.findIndex((l) => l.trim() === 'if (!bridge?.qr) {');
  if (fi < 0) { console.error('❌ cookie 退路找不到'); process.exit(1); }
  let depth = 0, end = -1;
  for (let i = fi; i < lines.length; i++) {
    for (const ch of lines[i]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0) { end = i; break; }
  }
  if (end < 0) { console.error('❌ cookie 退路大括號不匹配'); process.exit(1); }
  if (lines[end + 1] !== undefined && lines[end + 1].trim() === '') end++;
  lines.splice(fi, end - fi + 1);

  s = lines.join(eol);

  // 3) 函式改名 + 匯出
  s = s.replace('function showCookiePrompt() {', 'function showLoginPanel() {');
  s = s.replace('login: showCookiePrompt,', 'login: showLoginPanel,');

  // 4) 沒有掃碼能力時給明確錯誤，不要退回貼 cookie
  const anchor = "function showLoginPanel() {\r\n  const b = addAssistant();";
  const anchor2 = "function showLoginPanel() {\n  const b = addAssistant();";
  const use = s.includes(anchor) ? anchor : anchor2;
  if (!s.includes(use)) { console.error('❌ showLoginPanel 開頭找不到'); process.exit(1); }
  const e = use.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(use, [
    'function showLoginPanel() {',
    '  if (!bridge?.qr) {',
    "    addAssistant().insertAdjacentHTML('beforeend', '<div class=\"p\">這個版本沒有掃碼能力，請更新後再試。</div>');",
    '    return;',
    '  }',
    '  const b = addAssistant();',
  ].join(e));

  wr(f, s);
  console.log('app.js ok');
}

/* ── chrome.js：頂欄齒輪 ──────────────────────────────────── */
{
  const f = 'ui/chrome.js';
  let s = rd(f);
  if (!s.includes("mk('tbSettings'")) {
    s = s.replace(
      "  const moreBtn = mk('tbMore', 'more', '更多');",
      "  const setBtn = mk('tbSettings', 'settings', '設定');\n"
      + "  setBtn.addEventListener('click', () => window.__moyuOpenSettings?.());\n"
      + "  const moreBtn = mk('tbMore', 'more', '更多');"
    );
    s = s.replace("  right.appendChild(statBtn);", "  right.appendChild(statBtn);\n  right.appendChild(setBtn);");
    wr(f, s);
    console.log('chrome.js ok');
  } else console.log('chrome.js 已改過');
}

/* ── wiring.js：暴露 openSettings + 指令表 ────────────────── */
{
  const f = 'ui/wiring.js';
  let s = rd(f);
  const fn = "    refreshLoginState();\n  }";
  if (!s.includes('window.__moyuOpenSettings')) {
    s = s.replace(fn, fn + "\n  // 給頂欄齒輪與 /settings 指令用\n  window.__moyuOpenSettings = openSettings;");
  }
  if (!s.includes("['/settings'")) {
    s = s.replace(
      "    ['/login', '手機掃碼登入'],",
      "    ['/login', '手機掃碼登入'],\n    ['/settings', '設定（主題、字級、行距、登入）'],"
    );
  }
  wr(f, s);
  console.log('wiring.js ok');
}
