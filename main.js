'use strict';

const {
  app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage,
  session, shell, dialog, clipboard,
} = require('electron');
const path = require('path');
const fs = require('fs');

const fanqie = require('./src/fanqie');
const store = require('./src/store');

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
    minWidth: 960,
    minHeight: 620,
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
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });

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

/* ── 登入視窗 ───────────────────────────────────────────────── */
function openLogin() {
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      width: 520,
      height: 720,
      title: '登入',
      autoHideMenuBar: true,
      parent: win,
      webPreferences: { partition: 'persist:fanqie' },
    });
    w.setMenuBarVisibility(false);
    w.loadURL('https://fanqienovel.com/');

    const done = async () => {
      const cookies = await session.fromPartition('persist:fanqie').cookies.get({ domain: 'fanqienovel.com' });
      const names = cookies.map((c) => c.name);
      const logged = names.some((n) => /sessionid|passport|uid_tt|sid_tt|odin_tt/i.test(n));
      if (logged) {
        saveSessionCookies(cookies);
        w.destroy();
        resolve({ ok: true, cookies: names.length });
      }
    };
    w.webContents.on('did-navigate', () => setTimeout(done, 1200));
    w.webContents.on('did-navigate-in-page', () => setTimeout(done, 1200));
    w.on('closed', () => resolve({ ok: false }));
  });
}

let sessionCookies = [];

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

  ipcMain.handle('login:open', async () => {
    const r = await openLogin();
    return r;
  });

  ipcMain.handle('shelf:list', async () => {
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
    store.writeJson(path.join(DATA_DIR, 'chapters', `${chapterId}.json`), r);
    return r;
  });

  ipcMain.handle('progress:get', () => store.readJson(path.join(DATA_DIR, 'progress.json'), {}));
  ipcMain.handle('progress:set', (_e, p) => {
    store.writeJson(path.join(DATA_DIR, 'progress.json'), p);
    return true;
  });

  ipcMain.handle('cookie:set', (_e, v) => {
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
    return { ok: true };
  });

  ipcMain.handle('cookie:get', () => ({
    loggedIn: sessionCookies.length > 0,
    preview: sessionCookies.slice(0, 3).map((c) => c.name + '=…').join('; '),
  }));

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

    fanqie.setCharsetPath(path.join(__dirname, 'src', 'charset.json'));
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
