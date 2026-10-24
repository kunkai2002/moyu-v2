'use strict';

/* ══════════════════════════════════════════════════════════════
   魔芋一夏 · 本地服務
   ─────────────────────────────────────────────────────────────
   不依賴任何 npm 套件。跑起來之後用 Chrome 的「應用程式模式」開，
   看起來就是一個獨立桌面程式（沒有網址欄、沒有分頁）。

     node server.js                 預設 127.0.0.1:47821
     node server.js --port 8080
     node server.js --open          啟動後自動開視窗
   ══════════════════════════════════════════════════════════════ */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const fanqie = require('./src/fanqie');
const store = require('./src/store');
const appapi = require('./src/appapi');
const login = require('./src/login');
const { getShelf } = require('./src/shelf');
const sync = require('./src/sync');
const prefetch = require('./src/prefetch');
const { getBookComments } = require('./src/comments');

const ROOT = __dirname;
const UI = path.join(ROOT, 'ui');

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const PORT = Number(arg('port', 47821));
const HOST = arg('host', '0.0.0.0');
const DATA_DIR = arg('data', process.env.MOYU_DATA || path.join(ROOT, 'data'));
const OPEN = process.argv.includes('--open');

fs.mkdirSync(path.join(DATA_DIR, 'chapters'), { recursive: true });
fanqie.setCharsetPath(path.join(ROOT, 'src', 'charset.json'));
appapi.loadDevice(DATA_DIR);
sync.init(DATA_DIR);

/* ── 設定 ───────────────────────────────────────────────────── */
const DEFAULTS = {
  theme: 'claude-code',
  streamSpeed: 45,
  modelName: 'opus 4.5 · 中',
  fontScale: 1,
  windowTitle: 'api-server — node — 120×36',
};
const settingsPath = path.join(DATA_DIR, 'settings.json');
let settings = { ...DEFAULTS, ...store.readJson(settingsPath, {}) };

const cookiePath = path.join(DATA_DIR, 'cookie.txt');
const progressPath = path.join(DATA_DIR, 'progress.json');
const commentCache = new Map();
const updateCache = { at: 0, local: "", remote: "", err: "" };

/* ── 老闆鍵：SSE 廣播 ───────────────────────────────────────── */
let bossState = false;
const sseClients = new Set();
let qrSession = '';

function broadcast(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of sseClients) {
    try { c.write(line); } catch { sseClients.delete(c); }
  }
}

function cookie() {
  try { return fs.readFileSync(cookiePath, 'utf8').trim(); } catch { return ''; }
}

/* ── 靜態檔 ─────────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function serveStatic(req, res, urlPath) {
  let p = urlPath === '/' ? '/index.html' : urlPath;
  if (p === '/m' || p === '/m/') p = '/m/index.html';
  if (p.endsWith('/')) p += 'index.html';
  p = decodeURIComponent(p.split('?')[0]);
  const full = path.normalize(path.join(UI, p));
  if (!full.startsWith(UI)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
}

/* ── JSON 工具 ──────────────────────────────────────────────── */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 2e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); }
    });
  });
}

/* ── 路由 ───────────────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = u.pathname;

  try {
    /* ── API ── */
    if (p === '/api/config' && req.method === 'GET') {
      return json(res, 200, { ...settings, loggedIn: !!cookie(), dataDir: DATA_DIR });
    }

    if (p === '/api/config' && req.method === 'POST') {
      const patch = await readBody(req);
      settings = { ...settings, ...patch };
      store.writeJson(settingsPath, settings);
      return json(res, 200, settings);
    }

    if (p === '/api/cookie' && req.method === 'POST') {
      const { value } = await readBody(req);
      if (value && value.trim()) fs.writeFileSync(cookiePath, value.trim(), 'utf8');
      else fs.rmSync(cookiePath, { force: true });
      return json(res, 200, { ok: true, loggedIn: !!cookie() });
    }

    if (p === '/api/cookie' && req.method === 'GET') {
      const c = cookie();
      return json(res, 200, { loggedIn: !!c, preview: c ? c.slice(0, 24) + '…' : '' });
    }

    if (p === '/api/open' && req.method === 'POST') {
      const { input } = await readBody(req);
      const r = await fanqie.openBook(input, cookie());
      store.writeJson(path.join(DATA_DIR, 'last-book.json'), r.book);
      return json(res, 200, r);
    }

    if (p === '/api/chapter' && req.method === 'GET') {
      const bookId = u.searchParams.get('book');
      const chapterId = u.searchParams.get('id');
      if (!chapterId) return json(res, 400, { error: '缺 chapter id' });

      const cachePath = path.join(DATA_DIR, 'chapters', `${chapterId}.json`);
      const cached = store.readJson(cachePath, null);
      // 預覽片段不要當快取——之後接上 APP 網關就能拿到全文
      if (cached && !cached.previewOnly) return json(res, 200, cached);

      const r = await fanqie.loadChapter(bookId, chapterId, cookie());
      store.writeJson(cachePath, r);
      return json(res, 200, r);
    }

    if (p === '/api/progress' && req.method === 'GET') {
      return json(res, 200, store.readJson(progressPath, { books: {} }));
    }

    if (p === '/api/progress' && req.method === 'POST') {
      const body = await readBody(req);
      store.writeJson(progressPath, body);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/last-book' && req.method === 'GET') {
      return json(res, 200, store.readJson(path.join(DATA_DIR, 'last-book.json'), null));
    }

    if (p === '/api/shelf' && req.method === 'GET') {
      try {
        const r = await getShelf(cookie());
        store.writeJson(path.join(DATA_DIR, 'shelf.json'), r.books);
        return json(res, 200, { ok: true, ...r });
      } catch (e) {
        return json(res, 200, { ok: false, books: [], total: 0, error: e.message });
      }
    }

    if (p === '/api/export' && req.method === 'GET') {
      const bookId = u.searchParams.get('book');
      const limit = Math.max(1, Math.min(200, Number(u.searchParams.get('limit') || 50)));
      const bookFile = path.join(DATA_DIR, `book-${bookId}.json`);
      let book = store.readJson(bookFile, null);
      if (!book) {
        const r0 = await fanqie.openBook(bookId, cookie());
        book = r0.book;
        store.writeJson(bookFile, book);
      }
      const dir = path.join(DATA_DIR, 'exports');
      fs.mkdirSync(dir, { recursive: true });
      const safe = String(book.title).replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);

      let out = `${book.title}\n${book.author || ''}\n\n`;
      let got = 0, chars = 0;
      for (const c of book.chapters.slice(0, limit)) {
        let ch = store.readJson(path.join(DATA_DIR, 'chapters', `${c.id}.json`), null);
        if (!ch) {
          try {
            ch = await fanqie.loadChapter(book.id, c.id, cookie());
            store.writeJson(path.join(DATA_DIR, 'chapters', `${c.id}.json`), ch);
          } catch { continue; }
        }
        if (ch.previewOnly) continue;   // 預覽片段不進匯出檔
        out += `\n\n${c.title}\n\n${ch.paragraphs.join('\n')}\n`;
        got++; chars += ch.chars;
      }
      const file = path.join(dir, `${safe}.txt`);
      fs.writeFileSync(file, out, 'utf8');
      return json(res, 200, { ok: true, file, chapters: got, chars });
    }

    if (p === '/api/comments' && req.method === 'GET') {
      const bookId = u.searchParams.get('book');
      const sort = Number(u.searchParams.get('sort') || 1);
      const cursor = u.searchParams.get('cursor') || '';
      const ck = `${bookId}|${sort}|${cursor}`;
      if (commentCache.has(ck) && Date.now() - commentCache.get(ck).at < 120000) {
        return json(res, 200, commentCache.get(ck).data);
      }
      const r = await getBookComments(bookId, { sort, count: 12, cursor });
      commentCache.set(ck, { at: Date.now(), data: r });
      return json(res, 200, r);
    }

    if (p === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'hello', boss: bossState })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (p === '/api/boss') {
      if (req.method === 'POST') {
        const b = await readBody(req);
        bossState = b.on === undefined ? !bossState : !!b.on;
      }
      broadcast({ type: 'boss', on: bossState });
      return json(res, 200, { boss: bossState });
    }

    if (p === '/api/qr/start' && req.method === 'POST') {
      const q = await login.startQr();
      qrSession = q.cookie;
      return json(res, 200, { ok: true, token: q.token, image: q.image, expire: q.expire });
    }

    if (p === '/api/qr/poll' && req.method === 'GET') {
      const token = u.searchParams.get('token') || '';
      if (!token) return json(res, 400, { error: '缺 token' });
      const r = await login.pollQr(token, qrSession);
      if (r.status === 'confirmed' && r.sessionId) {
        fs.writeFileSync(cookiePath, r.cookie, 'utf8');
        qrSession = '';
        return json(res, 200, { ok: true, status: 'confirmed', loggedIn: true });
      }
      qrSession = r.cookie || qrSession;
      return json(res, 200, { ok: true, status: r.status, message: r.message || '' });
    }

    if (p === '/api/search' && req.method === 'GET') {
      const q = (u.searchParams.get('q') || '').trim();
      if (!q) return json(res, 400, { error: '缺 q' });
      const dir = path.join(DATA_DIR, 'chapters');
      let files = [];
      try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch {}
      const hits = [];
      for (const f of files) {
        const ch = store.readJson(path.join(dir, f), null);
        if (!ch || !Array.isArray(ch.paragraphs)) continue;
        ch.paragraphs.forEach((t, i) => {
          const at = t.indexOf(q);
          if (at >= 0 && hits.length < 100) {
            hits.push({
              chapterId: ch.chapterId,
              title: ch.title || '',
              para: i + 1,
              text: t.slice(Math.max(0, at - 16), at + q.length + 16),
            });
          }
        });
        if (hits.length >= 100) break;
      }
      return json(res, 200, { ok: true, q, hits, searched: files.length });
    }

    if (p === '/api/marks') {
      const f = path.join(DATA_DIR, 'marks.json');
      const all = store.readJson(f, {});
      if (req.method === 'GET') {
        const bookId = u.searchParams.get('book');
        return json(res, 200, { ok: true, marks: bookId ? (all[bookId] || []) : all });
      }
      const m = await readBody(req);
      const list = all[m.bookId] || [];
      if (m.action === 'remove') {
        all[m.bookId] = list.filter((x) => x.id !== m.id);
      } else {
        const id = m.id || (m.chapterId + '-' + m.para + '-' + m.type);
        const i = list.findIndex((x) => x.id === id);
        const rec = { ...m, id, at: Date.now() };
        if (i >= 0) list[i] = rec; else list.push(rec);
        all[m.bookId] = list;
      }
      store.writeJson(f, all);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/stats') {
      const f = path.join(DATA_DIR, 'stats.json');
      const db = store.readJson(f, { days: {} });
      if (req.method === 'POST') {
        const r = await readBody(req);
        const d = new Date().toISOString().slice(0, 10);
        const day = db.days[d] || { chars: 0, chapters: 0, seconds: 0 };
        day.chars += Number(r.chars) || 0;
        day.chapters += 1;
        day.seconds += Number(r.seconds) || 0;
        db.days[d] = day;
        store.writeJson(f, db);
        return json(res, 200, { ok: true, today: day });
      }
      const keys = Object.keys(db.days).sort();
      const today = db.days[new Date().toISOString().slice(0, 10)] || { chars: 0, chapters: 0, seconds: 0 };
      const last7 = keys.slice(-7).map((k) => ({ date: k, ...db.days[k] }));
      const total = keys.reduce((a, k) => ({
        chars: a.chars + db.days[k].chars,
        chapters: a.chapters + db.days[k].chapters,
        seconds: a.seconds + db.days[k].seconds,
      }), { chars: 0, chapters: 0, seconds: 0 });
      return json(res, 200, { ok: true, today, last7, total, days: keys.length });
    }

    if (p === '/api/version') {
      let sha = 'unknown', branch = 'main';
      try {
        const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
        if (head.startsWith('ref:')) {
          branch = head.slice(5).trim().split('/').pop();
          const refFile = path.join(ROOT, '.git', 'refs', 'heads', branch);
          if (fs.existsSync(refFile)) sha = fs.readFileSync(refFile, 'utf8').trim().slice(0, 7);
          else {
            const packed = fs.readFileSync(path.join(ROOT, '.git', 'packed-refs'), 'utf8');
            const line = packed.split('\n').find((l) => l.endsWith('refs/heads/' + branch));
            if (line) sha = line.split(' ')[0].slice(0, 7);
          }
        } else sha = head.slice(0, 7);
      } catch {}
      return json(res, 200, { ok: true, sha, branch, dataDir: DATA_DIR });
    }

    if (p === '/api/sync/status') {
      return json(res, 200, { ok: true, ...sync.status() });
    }

    if (p === '/api/sync/config' && req.method === 'POST') {
      const b = await readBody(req);
      return json(res, 200, { ok: true, ...sync.configure(b) });
    }

    if (p === '/api/sync/push') {
      try { return json(res, 200, { ok: true, ...(await sync.push(DATA_DIR)) }); }
      catch (e) { return json(res, 200, { ok: false, error: e.message }); }
    }

    if (p === '/api/sync/pull') {
      try { return json(res, 200, { ok: true, ...(await sync.pull(DATA_DIR)) }); }
      catch (e) { return json(res, 200, { ok: false, error: e.message }); }
    }

    if (p === '/api/prefetch/status') {
      return json(res, 200, { ok: true, job: prefetch.status() });
    }

    if (p === '/api/prefetch/stop') {
      return json(res, 200, { ok: true, job: prefetch.stop() });
    }

    if (p === '/api/prefetch' && req.method === 'POST') {
      const b = await readBody(req);
      const bookId = String(b.bookId || '');
      if (!bookId) return json(res, 400, { error: '缺 bookId' });
      try {
        let book = store.readJson(path.join(DATA_DIR, 'book-' + bookId + '.json'), null);
        if (!book) {
          const r0 = await fanqie.openBook(bookId, cookie());
          book = r0.book;
          store.writeJson(path.join(DATA_DIR, 'book-' + bookId + '.json'), book);
        }
        return json(res, 200, { ok: true, job: prefetch.start(DATA_DIR, book, cookie()) });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (p === '/api/update') {
      const now = Date.now();
      if (!updateCache.at || now - updateCache.at > 600000) {
        let sha = 'unknown';
        try {
          const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
          if (head.startsWith('ref:')) {
            const br = head.slice(5).trim().split('/').pop();
            const rf = path.join(ROOT, '.git', 'refs', 'heads', br);
            if (fs.existsSync(rf)) sha = fs.readFileSync(rf, 'utf8').trim().slice(0, 7);
          } else sha = head.slice(0, 7);
        } catch {}
        updateCache.local = sha;
        try {
          const body = await new Promise((resolve, reject) => {
            const req2 = https.get('https://api.github.com/repos/kunkai2002/moyu-v2/commits?per_page=1', {
              headers: { 'User-Agent': 'moyu-update' },
            }, (r) => {
              let d = '';
              r.on('data', (c) => { d += c; });
              r.on('end', () => resolve(d));
            });
            req2.on('error', reject);
            req2.setTimeout(8000, () => req2.destroy(new Error('timeout')));
          });
          const j = JSON.parse(body);
          updateCache.remote = j?.[0]?.sha ? j[0].sha.slice(0, 7) : '';
        } catch (e) { updateCache.remote = ''; updateCache.err = e.message; }
        updateCache.at = now;
      }
      const upToDate = !!updateCache.remote && updateCache.remote === updateCache.local;
      return json(res, 200, {
        ok: !!updateCache.remote,
        local: updateCache.local,
        remote: updateCache.remote,
        upToDate,
        error: updateCache.err || '',
      });
    }

    if (p === '/api/update/apply') {
      // 安裝版沒有原始碼庫，無法自我更新；告知使用者跑更新腳本
      const repo = process.env.MOYU_SRC || 'D:\\kun-workspace\\moyu-v2';
      const hasRepo = fs.existsSync(path.join(repo, 'server.js')) && fs.existsSync(path.join(repo, '更新.cmd'));
      return json(res, 200, {
        ok: true,
        applied: false,
        needReinstall: true,
        repo,
        message: hasRepo
          ? '請關掉程式，然後執行 ' + repo + '\\更新.cmd，完成後重新啟動'
          : '請重新解壓最新版覆蓋安裝目錄',
      });
    }

    if (p === '/api/health') {
      return json(res, 200, { ok: true, port: PORT, data: DATA_DIR });
    }

    /* ── 靜態 ── */
    return serveStatic(req, res, p);
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) });
  }
});

/* ── 開一個看起來像桌面程式的 Chrome 視窗 ───────────────────── */
function openAppWindow() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const exe = candidates.find((p) => p && fs.existsSync(p));
  const url = `http://127.0.0.1:${PORT}/`;
  if (!exe) {
    // 沒有 Chrome/Edge 就用預設瀏覽器開
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    console.log('找不到 Chrome/Edge，已用預設瀏覽器開啟 ' + url);
    return;
  }
  const profile = path.join(DATA_DIR, 'chrome-profile');
  fs.mkdirSync(profile, { recursive: true });
  const args = [
    `--app=${url}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,900',
    '--window-position=80,60',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter',
    '--autoplay-policy=no-user-gesture-required',
  ];
  const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('已開啟應用程式視窗（Chrome/Edge app mode）');
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`連接埠 ${PORT} 已經有服務在跑，直接開視窗。`);
    openAppWindow();
    setTimeout(() => process.exit(0), 800);
  } else {
    console.error(e);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log('魔芋一夏 · 服務已啟動');
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log(`  資料目錄 ${DATA_DIR}`);
  try {
    const nets = require('os').networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const n of list || []) {
        if (n.family === 'IPv4' && !n.internal) {
          console.log(`  手機版 http://${n.address}:${PORT}/m/`);
        }
      }
    }
  } catch {}
  if (OPEN) openAppWindow();
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
