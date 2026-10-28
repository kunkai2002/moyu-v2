'use strict';

// 首次顯示時不要讓 renderer 被背景節流，否則會出現白窗（要從托盤再點一次才畫）
require('electron').app.commandLine.appendSwitch('disable-renderer-backgrounding');
require('electron').app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
// 純文字閱讀器不需要 GPU；停用可避開 GPU 程序崩潰造成的白窗
require('electron').app.disableHardwareAcceleration();

const {
  app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage,
  clipboard, session,
} = require('electron');
const path = require('path');
const fs = require('fs');

const fanqie = require('./src/fanqie');
const store = require('./src/store');
const qrLogin = require('./src/login');
const bookstore = require('./src/shelf');
const appapi = require('./src/appapi');
const { search: searchInBook } = require('./src/search');
const syncer = require('./src/sync');

/* ── 設定 ───────────────────────────────────────────────────── */
const DEFAULT_SETTINGS = {
  theme: 'claude-code',
  windowTitle: 'api-server — node — 120×36',
  bossKey: 'Alt+Q',
  hideKey: 'Ctrl+Shift+Q',
  // 防截圖已移除
  closeToTray: true,
  streamSpeed: 45,          // 字/秒
  fontSize: 13.5,
  assistantName: '我',
  modelName: 'opus 4.5 · 中',
};

let settings = { ...DEFAULT_SETTINGS };
let win = null, tray = null, hidden = null;
let isBoss = false;

/* ── 資料目錄 ─────────────────────────────────────────────────
   可用 --data-dir 或 MOYU_DATA 指定；預設在 userData 底下。
   指定時連 Chromium 的 userData 一起搬過去，避免寫到 AppData。 */
function resolveDataDir() {
  const argv = process.argv.find((a) => a.startsWith('--data-dir='));
  if (argv) return argv.slice('--data-dir='.length);
  if (process.env.MOYU_DATA) return process.env.MOYU_DATA;
  return path.join(app.getPath('userData'), 'data');
}
let DATA_DIR = '';

{
  const early = resolveDataDir();
  if (process.argv.some((a) => a.startsWith('--data-dir=')) || process.env.MOYU_DATA) {
    try { fs.mkdirSync(early, { recursive: true }); app.setPath('userData', early); } catch {}
  }
}

/* ── 主視窗 ─────────────────────────────────────────────────── */
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 420,
    minHeight: 320,
    backgroundColor: '#1a1915',
    frame: false,
    titleBarStyle: 'hidden',
    title: settings.windowTitle,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'ui', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  /* 顯示時機：等到畫面真的漆完再現身。
     太早 show() 在部分顯示卡上會留下全白視窗，得從托盤再點一次才重繪。 */
  let revealed = false;
  let reloaded = false;
  const reveal = () => {
    if (revealed || !win || win.isDestroyed()) return;
    revealed = true;
    win.show();
    win.focus();
    try { win.moveTop(); } catch {}
    // Windows 會擋「搶焦點」，短暫置頂一次把視窗推到最前面
    try {
      win.setAlwaysOnTop(true);
      setTimeout(() => { try { if (win && !win.isDestroyed()) win.setAlwaysOnTop(false); } catch {} }, 400);
    } catch {}
    try { win.webContents.invalidate(); } catch {}
  };

  win.once('ready-to-show', () => setTimeout(reveal, 140));
  win.webContents.once('did-finish-load', () => {
    setTimeout(reveal, 200);
    // 自癒：載入後若內容是空的，無視快取重載一次
    setTimeout(async () => {
      if (!win || win.isDestroyed()) return;
      try {
        const len = await win.webContents.executeJavaScript('document.body.innerText.trim().length');
        if (len < 24 && !reloaded) { reloaded = true; win.webContents.reloadIgnoringCache(); }
      } catch {}
    }, 3200);
  });
  // 保險：無論如何 7 秒內一定現身
  setTimeout(reveal, 7000);

  win.on('close', (e) => {
    if (settings.closeToTray && !app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => { win = null; });
}

/* ── 老闆鍵 ─────────────────────────────────────────────────── */
function setBoss(on) {
  isBoss = on;
  if (win && !win.isDestroyed()) win.webContents.send('boss', on);
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  try { globalShortcut.register(settings.bossKey, () => setBoss(!isBoss)); } catch {}
  try {
    globalShortcut.register(settings.hideKey, () => {
      if (!win || win.isDestroyed()) return;
      win.isVisible() ? win.hide() : win.show();
    });
  } catch {}
}

/* ── 托盤 ───────────────────────────────────────────────────── */
function createTray() {
  // 一個 16×16 的點陣圖示，避免依賴外部檔案
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size);
    const d = Math.hypot(x - 7.5, y - 7.5);
    const on = d < 6.2 && d > 3.2;
    buf[i * 4 + 0] = on ? 0x57 : 0x1a;
    buf[i * 4 + 1] = on ? 0x77 : 0x19;
    buf[i * 4 + 2] = on ? 0xd9 : 0x15;
    buf[i * 4 + 3] = 255;
  }
  const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
  tray = new Tray(img);
  tray.setToolTip(settings.windowTitle);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '顯示視窗', click: () => { win.show(); win.focus(); } },
    { label: '老闆鍵', accelerator: settings.bossKey, click: () => setBoss(!isBoss) },
    { type: 'separator' },
    { label: '結束', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => { if (win) { win.isVisible() ? win.hide() : win.show(); } });
}

let sessionCookies = [];
const qrJar = new Map();   // token -> 累積下來的 passport cookie

function saveSessionCookies(cookies) {
  sessionCookies = cookies;
  store.writeJson(path.join(DATA_DIR, 'cookies.json'), cookies);
}

function loadSessionCookies() {
  const p = path.join(DATA_DIR, 'cookies.json');
  if (fs.existsSync(p)) {
    try { sessionCookies = store.readJson(p, []); } catch { sessionCookies = []; }
  }
  return sessionCookies;
}

/* 登入後把 cookie 同步進網頁分區，網頁版備援才有登入態 */
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

function cookieHeader() {
  if (!sessionCookies.length) loadSessionCookies();
  return sessionCookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/* ── 書架：用隱藏視窗讀官方頁面的 DOM ───────────────────────── */
async function fetchShelf() {
  const w = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: { partition: 'persist:fanqie', offscreen: false },
  });
  try {
    await w.loadURL('https://fanqienovel.com/bookshelf');
    await new Promise((r) => setTimeout(r, 3500));
    const list = await w.webContents.executeJavaScript(`(() => {
      const out = [];
      const seen = new Set();
      document.querySelectorAll('a[href^="/page/"]').forEach((a) => {
        const m = a.getAttribute('href').match(/\\/page\\/(\\d+)/);
        if (!m || seen.has(m[1])) return;
        seen.add(m[1]);
        const img = a.querySelector('img');
        const t = (a.getAttribute('title') || a.textContent || '').trim();
        out.push({ id: m[1], title: t.slice(0, 40), cover: img ? img.src : '' });
      });
      return out;
    })()`);
    return list || [];
  } catch (e) {
    return [];
  } finally {
    if (!w.isDestroyed()) w.destroy();
  }
}

/* ── IPC ────────────────────────────────────────────────────── */
function registerIpc() {
  /* 偏好設定：存在 data/prefs.json，重裝或換版都還在 */
  const prefsPath = () => path.join(DATA_DIR, 'prefs.json');

  ipcMain.on('prefs:read', (e) => {
    try { e.returnValue = store.readJson(prefsPath(), {}); } catch { e.returnValue = {}; }
  });

  ipcMain.on('prefs:write', (_e, obj) => {
    try {
      if (obj && typeof obj === 'object') store.writeJson(prefsPath(), obj);
    } catch {}
  });

  ipcMain.handle('config:get', () => ({
    ...settings,
    dataDir: DATA_DIR,
    loggedIn: sessionCookies.length > 0,
  }));

  ipcMain.handle('config:set', (_e, patch) => {
    settings = { ...settings, ...patch };
    store.writeJson(path.join(DATA_DIR, 'settings.json'), settings);
    if (win && !win.isDestroyed() && patch.windowTitle) win.setTitle(patch.windowTitle);
    if (patch.bossKey || patch.hideKey) registerHotkeys();
    return settings;
  });

  /* 掃碼登入：QR 由 passport 產生，確認後把 sessionid 等 cookie 存起來 */
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
        await syncWebSession();
    }
    return { status: r.status, message: r.message || '', ok: !!r.sessionId };
  });

ipcMain.handle('shelf:raw', async () => {
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
  });

  ipcMain.handle('shelf:cached', () => store.readJson(path.join(DATA_DIR, 'shelf.json'), []));

  ipcMain.handle('book:open', async (_e, input) => {
    const r = await fanqie.openBook(input, cookieHeader());
    store.writeJson(path.join(DATA_DIR, `book-${r.book.id}.json`), r.book);
    return r;
  });

  ipcMain.handle('chapter:load', async (_e, { bookId, chapterId }) => {
    const key = `ch-${bookId}-${chapterId}`;
    const cached = store.readJson(path.join(DATA_DIR, 'chapters', `${chapterId}.json`), null);
    if (cached) return cached;
    const r = await fanqie.loadChapter(bookId, chapterId, cookieHeader());
    // 只有試讀的結果不要存，之後有完整正文才有機會補上
    if (!r.previewOnly) store.writeJson(path.join(DATA_DIR, 'chapters', `${chapterId}.json`), r);
    return r;
  });

  /* 標記：跟伺服器版同一份 marks.json */
  const marksPath = () => path.join(DATA_DIR, 'marks.json');

  /* 內建官網視窗：逛網站、掃碼登入都用它 */
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

  ipcMain.handle('search:query', (_e, payload) => {
    try {
      const { bookId, q } = payload || {};
      return searchInBook(DATA_DIR, bookId, q, 40);
    } catch (e) { return { ok: false, error: e.message, hits: [], total: 0 }; }
  });

  ipcMain.handle('marks:list', (_e, bookId) => {
    const all = store.readJson(marksPath(), {});
    return bookId ? (all[bookId] || []) : all;
  });

  ipcMain.handle('marks:save', (_e, m) => {
    if (!m || !m.bookId) return { ok: false, error: '缺少 bookId' };
    const all = store.readJson(marksPath(), {});
    const list = all[m.bookId] || [];
    const id = m.id || (m.chapterId + '-' + m.para + '-' + m.type);
    const i = list.findIndex((x) => x.id === id);
    const rec = { ...m, id, at: Date.now() };
    if (i >= 0) list[i] = rec; else list.push(rec);
    all[m.bookId] = list;
    store.writeJson(marksPath(), all);
    return { ok: true, id };
  });

  ipcMain.handle('marks:remove', (_e, { bookId, id }) => {
    const all = store.readJson(marksPath(), {});
    all[bookId] = (all[bookId] || []).filter((x) => x.id !== id);
    store.writeJson(marksPath(), all);
    return { ok: true };
  });

  /* 雲端同步（Cloudflare Worker） */
/* 閱讀統計：跟伺服器版同一份 stats.json */
  ipcMain.handle('stats:get', () => {
    const db = store.readJson(path.join(DATA_DIR, 'stats.json'), { days: {} });
    const keys = Object.keys(db.days).sort();
    const today = db.days[new Date().toISOString().slice(0, 10)] || { chars: 0, chapters: 0, seconds: 0 };
    const last7 = keys.slice(-7).map((k) => ({ date: k, ...db.days[k] }));
    const total = keys.reduce((a, k) => ({
      chars: a.chars + db.days[k].chars,
      chapters: a.chapters + db.days[k].chapters,
      seconds: a.seconds + db.days[k].seconds,
    }), { chars: 0, chapters: 0, seconds: 0 });
    return { ok: true, today, last7, total, days: keys.length };
  });

  ipcMain.handle('stats:add', (_e, r) => {
    const fpath = path.join(DATA_DIR, 'stats.json');
    const db = store.readJson(fpath, { days: {} });
    const d = new Date().toISOString().slice(0, 10);
    const day = db.days[d] || { chars: 0, chapters: 0, seconds: 0 };
    day.chars += Number(r && r.chars) || 0;
    day.chapters += 1;
    day.seconds += Number(r && r.seconds) || 0;
    db.days[d] = day;
    store.writeJson(fpath, db);
    return { ok: true, today: day };
  });

  ipcMain.handle('sync:status', () => syncer.status());
  ipcMain.handle('sync:config', (_e, cfg) => {
    try { syncer.configure(cfg || {}); return { ok: true, ...syncer.status() }; }
    catch (e) { return { ok: false, error: e.message, ...syncer.status() }; }
  });
  ipcMain.handle('sync:push', async () => {
    try { const r = await syncer.push(DATA_DIR); return { ok: true, ...r, status: syncer.status() }; }
    catch (e) { return { ok: false, error: e.message, status: syncer.status() }; }
  });
  ipcMain.handle('sync:pull', async () => {
    try { const r = await syncer.pull(DATA_DIR); return { ok: true, ...r, status: syncer.status() }; }
    catch (e) { return { ok: false, error: e.message, status: syncer.status() }; }
  });

  ipcMain.handle('progress:get', () => store.readJson(path.join(DATA_DIR, 'progress.json'), {}));
  ipcMain.handle('progress:set', (_e, p) => {
    store.writeJson(path.join(DATA_DIR, 'progress.json'), p);
    return true;
  });

  ipcMain.handle('cookie:set', async (_e, v) => {
    if (v && String(v).trim()) {
      const c = String(v).trim();
      fs.writeFileSync(path.join(DATA_DIR, 'cookie.txt'), c, 'utf8');
      // 轉成 cookie 陣列，讓後續請求直接可用
      sessionCookies = c.split(';').map((kv) => {
        const i = kv.indexOf('=');
        return { name: kv.slice(0, i).trim(), value: kv.slice(i + 1).trim() };
      }).filter((x) => x.name);
      store.writeJson(path.join(DATA_DIR, 'cookies.json'), sessionCookies);
    } else {
      fs.rmSync(path.join(DATA_DIR, 'cookie.txt'), { force: true });
      sessionCookies = [];
    }
    await syncWebSession();
    return { ok: true };
  });

  ipcMain.handle('cookie:get', () => ({
    loggedIn: sessionCookies.length > 0,
    preview: sessionCookies.slice(0, 3).map((c) => c.name + '=…').join('; '),
  }));

  ipcMain.handle('clipboard:plain', (_e, text) => {
    clipboard.writeText(String(text == null ? '' : text));
    return true;
  });

  ipcMain.handle('clipboard:write', (_e, text) => {
    // 複製時加上看起來像程式碼的前綴
    clipboard.writeText(text.split('\n').map((l) => '// ' + l).join('\n'));
    return true;
  });

  ipcMain.handle('app:boss', (_e, on) => { setBoss(!!on); return isBoss; });
  ipcMain.handle('app:hide', () => { if (win) win.hide(); return true; });
  ipcMain.handle('app:quit', () => { app.isQuitting = true; app.quit(); });

  /* 自訂標題列用的視窗控制 */
  ipcMain.handle('win:min', () => { win?.minimize(); return true; });
  ipcMain.handle('win:max', () => {
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('win:close', () => {
    if (!win) return true;
    if (settings.closeToTray) win.hide(); else { app.isQuitting = true; win.close(); }
    return true;
  });
}

/* ── 啟動 ───────────────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

  app.whenReady().then(async () => {
    DATA_DIR = resolveDataDir();
    fs.mkdirSync(path.join(DATA_DIR, 'chapters'), { recursive: true });

    const sp = path.join(DATA_DIR, 'settings.json');
    if (fs.existsSync(sp)) {
      try { settings = { ...DEFAULT_SETTINGS, ...store.readJson(sp, {}) }; } catch {}
    }
    loadSessionCookies();
    syncWebSession();

    fanqie.setCharsetPath(path.join(__dirname, 'src', 'charset.json'));
    // 匿名裝置（跟帳號無關）：沒有它 APP 網關拿不到完整正文，只能退回網頁預覽
    appapi.useDataDir(DATA_DIR);
    syncer.init(DATA_DIR);
    registerIpc();
    createWindow();
    createTray();
    registerHotkeys();

    // 煙霧測試：截一張真實視窗的圖然後退出
    if (process.argv.some((a) => a.startsWith('--smoke'))) {
      win.webContents.once('did-finish-load', async () => {
        await new Promise((r) => setTimeout(r, 2600));
        const img = await win.webContents.capturePage();
        const out = process.argv.find((a) => a.startsWith('--smoke='))?.slice(8)
          || path.join(DATA_DIR, 'smoke.png');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, img.toPNG());
        console.log('SMOKE_PNG=' + out);
        setTimeout(() => { app.isQuitting = true; app.quit(); }, 400);
      });
    }
  });

  app.on('window-all-closed', () => { /* 托盤常駐，不退出 */ });
  app.on('before-quit', () => { globalShortcut.unregisterAll(); });
}
