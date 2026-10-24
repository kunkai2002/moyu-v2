// ① /login 走掃碼（Electron IPC）② 設定入口：齒輪圖標 + /settings 指令
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 找不到錨點: ' + tag); process.exit(1); } };

/* ── main.js ───────────────────────────────────────────────── */
{
  const f = 'main.js';
  let s = rd(f);

  must(s, "const store = require('./src/store');", 'store require');
  s = s.replace(
    "const store = require('./src/store');",
    "const store = require('./src/store');\nconst qrLogin = require('./src/login');"
  );

  // 刪掉舊的「開一個瀏覽器視窗登入」
  const start = s.indexOf('/* ── 登入視窗');
  const end = s.indexOf('let sessionCookies = [];');
  if (start < 0 || end < 0) { console.error('❌ 登入視窗區塊定位失敗'); process.exit(1); }
  s = s.slice(0, start) + s.slice(end);

  must(s, "ipcMain.handle('login:open', async () => {\n    const r = await openLogin();\n    return r;\n  });", 'login:open handler');
  s = s.replace(
    "ipcMain.handle('login:open', async () => {\n    const r = await openLogin();\n    return r;\n  });",
    `/* 掃碼登入：QR 由 passport 產生，確認後把 sessionid 等 cookie 存起來 */
  ipcMain.handle('qr:start', async () => {
    const q = await qrLogin.startQr();
    qrJar.set(q.token, q.cookie || '');
    return { token: q.token, image: q.image, expire: q.expire };
  });

  ipcMain.handle('qr:poll', async (_e, token) => {
    const jar = qrJar.get(token) || '';
    const r = await qrLogin.pollQr(token, jar);
    qrJar.set(token, r.cookie || jar);
    if (r.status === 'confirmed' && r.sessionId) {
      const cookies = String(r.cookie || '').split(';').map((kv) => {
        const i = kv.indexOf('=');
        return i > 0 ? { name: kv.slice(0, i).trim(), value: kv.slice(i + 1).trim() } : null;
      }).filter((c) => c && c.name && c.value);
      if (cookies.length) {
        sessionCookies = cookies;
        store.writeJson(path.join(DATA_DIR, 'cookies.json'), cookies);
        fs.writeFileSync(path.join(DATA_DIR, 'cookie.txt'),
          cookies.map((c) => c.name + '=' + c.value).join('; '), 'utf8');
      }
      qrJar.delete(token);
    }
    return { status: r.status, message: r.message || '', ok: !!r.sessionId };
  });`
  );

  must(s, "let sessionCookies = [];", 'sessionCookies decl');
  s = s.replace("let sessionCookies = [];", "let sessionCookies = [];\nconst qrJar = new Map();   // token -> 累積下來的 passport cookie");

  // 清掉沒用的 import
  s = s.replace(
    "  session, shell, dialog, clipboard,",
    "  clipboard,"
  );

  wr(f, s);
  console.log('main.js ok');
}

/* ── preload.js ────────────────────────────────────────────── */
{
  const f = 'ui/preload.js';
  let s = rd(f);
  must(s, "  login: () => ipcRenderer.invoke('login:open'),", 'preload login');
  s = s.replace(
    "  login: () => ipcRenderer.invoke('login:open'),",
    "  qr: {\n    start: () => ipcRenderer.invoke('qr:start'),\n    poll: (token) => ipcRenderer.invoke('qr:poll', token),\n  },"
  );
  wr(f, s);
  console.log('preload.js ok');
}

/* ── app.js ────────────────────────────────────────────────── */
{
  const f = 'ui/app.js';
  let s = rd(f);

  must(s, "if (/^\\/login$/i.test(text)) { showCookiePrompt(); return; }", '/login dispatch');
  s = s.replace(
    "if (/^\\/login$/i.test(text)) { showCookiePrompt(); return; }",
    "if (/^\\/(login|qr)$/i.test(text)) { showLoginPanel(); return; }\n"
    + "  if (/^\\/(settings|set|config)$/i.test(text)) { window.__moyuOpenSettings?.(); return; }"
  );

  // 拿掉「貼 cookie」的退路：/login 一律掃碼
  const fbStart = s.indexOf('  if (!bridge?.qr) {');
  const fbEnd = s.indexOf('  b.insertAdjacentHTML(\'beforeend\', `\n    <div class="tool">⏺ <span class="fn">login.qrcode</span></div>');
  if (fbStart < 0 || fbEnd < 0) { console.error('❌ cookie 退路區塊定位失敗'); process.exit(1); }
  s = s.slice(0, fbStart) + s.slice(fbEnd);

  s = s.replace('function showCookiePrompt() {', 'function showLoginPanel() {');
  s = s.replace('login: showCookiePrompt,', 'login: showLoginPanel,');

  // 掃不到 QR 能力時給明確訊息，而不是退回貼 cookie
  must(s, '  const box = b.querySelector(\'#qrBox\');', 'qr box');
  s = s.replace(
    "  const box = b.querySelector('#qrBox');",
    "  if (!bridge?.qr) {\n"
    + "    b.querySelector('#qrBox').outerHTML = '<div class=\"p\">這個版本沒有掃碼能力，請更新後再試。</div>';\n"
    + "    return;\n"
    + "  }\n"
    + "  const box = b.querySelector('#qrBox');"
  );

  wr(f, s);
  console.log('app.js ok');
}

/* ── chrome.js：頂欄加齒輪 ────────────────────────────────── */
{
  const f = 'ui/chrome.js';
  let s = rd(f);
  must(s, "  const moreBtn = mk('tbMore', 'more', '更多');", 'chrome moreBtn');
  s = s.replace(
    "  const moreBtn = mk('tbMore', 'more', '更多');",
    "  const setBtn = mk('tbSettings', 'settings', '設定');\n"
    + "  setBtn.addEventListener('click', () => window.__moyuOpenSettings?.());\n"
    + "  const moreBtn = mk('tbMore', 'more', '更多');"
  );
  must(s, "  right.appendChild(statBtn);", 'chrome append stat');
  s = s.replace("  right.appendChild(statBtn);", "  right.appendChild(statBtn);\n  right.appendChild(setBtn);");
  wr(f, s);
  console.log('chrome.js ok');
}

/* ── wiring.js：對外暴露設定面板 + 指令表補一行 ────────────── */
{
  const f = 'ui/wiring.js';
  let s = rd(f);
  must(s, "  function openSettings() {\n    toggle(panel, true);\n    refreshLoginState();\n  }", 'wiring openSettings');
  s = s.replace(
    "  function openSettings() {\n    toggle(panel, true);\n    refreshLoginState();\n  }",
    "  function openSettings() {\n    toggle(panel, true);\n    refreshLoginState();\n  }\n"
    + "  // 給頂欄齒輪與 /settings 指令用\n"
    + "  window.__moyuOpenSettings = openSettings;"
  );
  must(s, "    ['/login', '手機掃碼登入'],", 'wiring help login');
  s = s.replace(
    "    ['/login', '手機掃碼登入'],",
    "    ['/login', '手機掃碼登入'],\n    ['/settings', '設定（主題、字級、行距、登入）'],"
  );
  wr(f, s);
  console.log('wiring.js ok');
}
