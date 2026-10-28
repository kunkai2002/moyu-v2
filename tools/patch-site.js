// 打開番茄官網（內建視窗，共用 persist:fanqie 分區，登入態會同步）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── main.js ─────────────────────────────────────────────── */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('site:open')) {
    must(s, "  ipcMain.handle('search:query'", 'main search ipc');
    s = s.replace(
      "  ipcMain.handle('search:query'",
      `  /* 內建官網視窗：逛網站、掃碼登入都用它 */
  ipcMain.handle('site:open', async (_e, url) => {
    const target = String(url || 'https://fanqienovel.com/');
    try {
      const w = new BrowserWindow({
        width: 1080, height: 760, title: '番茄小說',
        autoHideMenuBar: true, parent: win || undefined,
        webPreferences: { partition: 'persist:fanqie' },
      });
      w.setMenuBarVisibility(false);
      w.loadURL(target);
      // 網站登入後把 cookie 收進來
      const harvest = async () => {
        try {
          const ses = session.fromPartition('persist:fanqie');
          const cookies = await ses.cookies.get({ domain: 'fanqienovel.com' });
          const names = (cookies || []).map((c) => c.name);
          if (names.some((n) => /sessionid|passport|uid_tt|sid_tt/i.test(n))) {
            sessionCookies = (cookies || []).map((c) => ({ name: c.name, value: c.value }));
            store.writeJson(path.join(DATA_DIR, 'cookies.json'), sessionCookies);
            fs.writeFileSync(path.join(DATA_DIR, 'cookie.txt'),
              sessionCookies.map((c) => c.name + '=' + c.value).join('; '), 'utf8');
          }
        } catch {}
      };
      w.webContents.on('did-navigate', () => setTimeout(harvest, 800));
      w.webContents.on('did-navigate-in-page', () => setTimeout(harvest, 800));
      w.on('closed', () => { setTimeout(harvest, 400); });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('search:query'`
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js ok');
  } else console.log('main.js 已有 site:open');
}

/* ── preload.js ──────────────────────────────────────────── */
{
  const f = p('ui/preload.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('openSite')) {
    must(s, "  search: (bookId, q)", 'preload search');
    s = s.replace(
      "  search: (bookId, q)",
      "  openSite: (url) => ipcRenderer.invoke('site:open', url),\r\n  search: (bookId, q)"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('preload.js ok');
  } else console.log('preload.js 已有 openSite');
}

/* ── shell.js：首頁加兩個真按鈕（官網 / 掃碼登入）─────────── */
{
  const f = p('ui/shell.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('homeActions')) {
    must(s, "    html += '<div class=\"home-sec\">書架<button id=\"homeReload\">重新載入</button></div>'", 'shell shelf sec');
    s = s.replace(
      "    html += '<div class=\"home-sec\">書架<button id=\"homeReload\">重新載入</button></div>'",
      `    html += '<div class="home-actions">'
      + '<button class="home-act" id="homeSite">打開官網</button>'
      + '<button class="home-act" id="homeLogin">掃碼登入</button>'
      + '</div>';
    html += '<div class="home-sec">書架<button id="homeReload">重新載入</button></div>'`
    );

    must(s, "    body.querySelector('#homeReload')?.addEventListener('click', function () { paintShelf(true); });", 'shell reload bind');
    s = s.replace(
      "    body.querySelector('#homeReload')?.addEventListener('click', function () { paintShelf(true); });",
      `    body.querySelector('#homeReload')?.addEventListener('click', function () { paintShelf(true); });
    body.querySelector('#homeSite')?.addEventListener('click', function () {
      if (B.openSite) B.openSite('https://fanqienovel.com/'); else D.login();
    });
    body.querySelector('#homeLogin')?.addEventListener('click', function () { D.login(); });`
    );

    must(s, "    '.home-empty{color:var(--fg3);font-size:12px;padding:8px 2px}',", 'shell home empty css');
    s = s.replace(
      "    '.home-empty{color:var(--fg3);font-size:12px;padding:8px 2px}',",
      `    '.home-empty{color:var(--fg3);font-size:12px;padding:8px 2px}',
    '.home-actions{display:flex;gap:8px;margin:2px 0 4px}',
    '.home-act{border:1px solid var(--line-strong);border-radius:6px;padding:5px 12px;font-size:12px;',
    '  color:var(--fg2);background:var(--bg-elev)}',
    '.home-act:hover{border-color:var(--acc);color:var(--fg)}',`
    );

    fs.writeFileSync(f, s, 'utf8');
    console.log('shell.js ok');
  } else console.log('shell.js 已有 homeActions');
}
