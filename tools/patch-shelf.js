// 修書架：Electron 端沒有 shelf.raw，改用 Node 端官方 API（含網頁版備援）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── main.js ──────────────────────────────────────────────── */
{
  const f = 'main.js';
  let s = rd(f);

  must(s, "const qrLogin = require('./src/login');", 'login require');
  s = s.replace(
    "const qrLogin = require('./src/login');",
    "const qrLogin = require('./src/login');\nconst bookstore = require('./src/shelf');"
  );

  // 需要 session 把 cookie 灌進網頁分區
  must(s, "  clipboard,", 'imports');
  s = s.replace("  clipboard,", "  clipboard, session,");

  // shelf:list → shelf:raw（官方 API 優先，失敗才退回抓網頁）
  must(s, "  ipcMain.handle('shelf:list', async () => {\n    const list = await fetchShelf();\n    store.writeJson(path.join(DATA_DIR, 'shelf.json'), list);\n    return list;\n  });", 'shelf:list');
  s = s.replace(
    "  ipcMain.handle('shelf:list', async () => {\n    const list = await fetchShelf();\n    store.writeJson(path.join(DATA_DIR, 'shelf.json'), list);\n    return list;\n  });",
    `ipcMain.handle('shelf:raw', async () => {
    const cookie = cookieHeader();
    if (!cookie) return { ok: false, books: [], total: 0, error: '還沒登入（打 /login 掃碼）' };
    try {
      const r = await bookstore.getShelf(cookie);
      if (r.books && r.books.length) store.writeJson(path.join(DATA_DIR, 'shelf.json'), r.books);
      return { ok: true, books: r.books || [], total: r.total || (r.books || []).length };
    } catch (e) {
      // 官方 API 不通時，用已登入的網頁視窗再試一次
      const list = await fetchShelf();
      if (list.length) {
        store.writeJson(path.join(DATA_DIR, 'shelf.json'), list);
        return { ok: true, books: list, total: list.length };
      }
      return { ok: false, books: [], total: 0, error: e.message };
    }
  });

  ipcMain.handle('shelf:list', async () => {
    const cookie = cookieHeader();
    if (cookie) {
      try {
        const r = await bookstore.getShelf(cookie);
        if (r.books.length) { store.writeJson(path.join(DATA_DIR, 'shelf.json'), r.books); return r.books; }
      } catch {}
    }
    const list = await fetchShelf();
    store.writeJson(path.join(DATA_DIR, 'shelf.json'), list);
    return list;
  });`
  );

  // 把 cookie 灌進 persist:fanqie，網頁備援才看得到登入態
  must(s, 'function cookieHeader() {', 'cookieHeader');
  s = s.replace(
    'function cookieHeader() {',
    `/* 登入後把 cookie 同步進網頁分區，網頁版備援才有登入態 */
async function syncWebSession() {
  try {
    const ses = session.fromPartition('persist:fanqie');
    const exp = Math.floor(Date.now() / 1000) + 86400 * 60;
    for (const c of sessionCookies) {
      if (!c || !c.name || !c.value) continue;
      try {
        await ses.cookies.set({
          url: 'https://fanqienovel.com/', name: c.name, value: c.value,
          domain: '.fanqienovel.com', path: '/', secure: true, httpOnly: false, expirationDate: exp,
        });
      } catch {}
    }
  } catch {}
}

function cookieHeader() {`
  );

  // 掃碼成功後同步；cookie:set 後也同步；開機也同步一次
  must(s, "      qrJar.delete(token);", 'qr delete');
  s = s.replace("      qrJar.delete(token);", "      qrJar.delete(token);\n        await syncWebSession();");

  must(s, "    return { ok: true };\n  });\n\n  ipcMain.handle('cookie:get'", 'cookie:set');
  s = s.replace(
    "    return { ok: true };\n  });\n\n  ipcMain.handle('cookie:get'",
    "    await syncWebSession();\n    return { ok: true };\n  });\n\n  ipcMain.handle('cookie:get'"
  );

  must(s, "    loadSessionCookies();", 'loadSessionCookies call');
  s = s.replace("    loadSessionCookies();", "    loadSessionCookies();\n    syncWebSession();");

  wr(f, s);
  console.log('main.js ok');
}

/* ── preload.js ───────────────────────────────────────────── */
{
  const f = 'ui/preload.js';
  let s = rd(f);
  must(s, "  shelf: {", 'preload shelf');
  if (!s.includes('raw:')) {
    s = s.replace(
      "  shelf: {\n    list: () => ipcRenderer.invoke('shelf:list'),",
      "  shelf: {\n    raw: () => ipcRenderer.invoke('shelf:raw'),\n    list: () => ipcRenderer.invoke('shelf:list'),"
    );
    wr(f, s);
    console.log('preload.js ok');
  } else console.log('preload.js 已含 raw');
}
