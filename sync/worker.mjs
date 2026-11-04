/**
 * 魔芋一夏 · 後端（Cloudflare Worker + D1）
 *
 * 三件事：
 *   1. 同步：進度 / 標記（Bearer SYNC_TOKEN）
 *   2. 鏡像站：/m/、/staging/m/ 供應「桌面版同一份 ui/」
 *      —— 資產由 tools/build-web.js 打包成 sync/web-assets.mjs，這裡不碰 sync/m/
 *      —— 瀏覽器模式的 window.moyu 由 ui/bridge-http.js 用 /api/* 補（token 走 #t=）
 *   3. 番茄代理 API（同一把金鑰）
 *
 * 部署（JOJO 點頭後才做）：
 *   node tools/build-web.js                 # ui/ → sync/web-assets.mjs
 *   npx wrangler d1 execute moyu-sync --file=./schema.sql --remote
 *   npx wrangler secret put SYNC_TOKEN
 *   npx wrangler deploy
 */

import { ASSETS, TYPES } from './web-assets.mjs';
import { openBook, loadChapter, getShelf } from './fanqie.mjs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.replace(/^Bearer\s+/i, '');
}

function authed(req, env) {
  return !!env.SYNC_TOKEN && bearer(req) === env.SYNC_TOKEN;
}

const ext = (p) => p.slice(p.lastIndexOf('.'));

const FILE_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.vbs': 'text/plain; charset=utf-8',
  '.cmd': 'text/plain; charset=utf-8',
};

const fileType = (p) => FILE_TYPES[ext(p)] || 'text/plain; charset=utf-8';

/* app_files 的 body 一律存 base64（原始位元組），這裡解回 bytes。
   不要用字串回傳：老檔案裡有非 UTF-8 位元組，一轉字串就被改掉了。 */
function b64Bytes(b64) {
  const bin = atob(String(b64 || ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── 鏡像站資產（桌面版同一份 ui/） ──
   ASSETS 的 key 一律是 '/m/<ui 檔名>'；/m/ 與 /staging/m/ 都指向同一份，
   所以沒有第二套手機殼，也沒有「staging 一份、正式一份」的分叉。 */
const WEB_PREFIX = '/m/';

/* 把 URL 掛載點後面的尾巴變成安全的相對檔名；空字串＝首頁 index.html。
   回 null 代表這條路徑不服務（..、開頭斜線、編碼壞掉、空段）。 */
function webRel(pathname, mount) {
  let rel = pathname.slice(mount.length);
  if (!rel) return 'index.html';
  try { rel = decodeURIComponent(rel); } catch { return null; }
  if (!rel || rel.startsWith('/') || rel.includes('\\')) return null;
  if (rel.split('/').some((s) => s === '' || s === '.' || s === '..')) return null;
  return rel;
}

function webFile(rel) {
  const key = WEB_PREFIX + rel;
  const body = ASSETS[key];
  if (body === undefined) return null;
  return new Response(body, {
    headers: {
      'content-type': TYPES[ext(key)] || 'text/plain; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
}

function webServe(pathname, mount) {
  const rel = webRel(pathname, mount);
  const hit = rel ? webFile(rel) : null;
  return hit || new Response('not found: ' + pathname, {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/* 瀏覽器模式明確不支援的功能：回 501 JSON，讓 ui 的 try/catch 收得到，
   而不是 500 把整頁打掉（qr/登入/tunnel/預取/熱更新/雲端設定都是桌面專屬）。 */
const desktopOnly = (what) =>
  json({ ok: false, desktopOnly: true, error: what + '只有桌面版提供（鏡像站是唯讀網頁）' }, 501);

async function getCookie(env) {
  try {
    const row = await env.DB.prepare('SELECT value FROM config WHERE key = ?').bind('cookie').first();
    return (row && row.value) || '';
  } catch {
    return '';
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === '/health') return json({ ok: true, service: 'moyu-sync' });

    /* ── 鏡像站靜態頁：桌面版同一份 ui/（不需要金鑰，金鑰在網址 #t= 交給 bridge-http.js） ──
       /m/ 與 /staging/m/ 送同一份資產；舊的 sync/m/ 手機殼已停用，不再被任何路徑路由到。 */
    if (p === '/favicon.ico') return new Response(null, { status: 204 });
    if (p === '/m') return Response.redirect(url.origin + '/m/', 302);
    if (p.startsWith('/m/')) return webServe(p, '/m/');

    if (p === '/staging/m') return Response.redirect(url.origin + '/staging/m/', 302);
    if (p.startsWith('/staging/m/')) return webServe(p, '/staging/m/');

    /* ── 應用程式熱更新：清單與單檔（公開，內容跟 GitHub 公開版一樣） ──
       env=staging → 讀 s/ 前綴那一份（測試站），正式站不受影響 */
    const appEnv = url.searchParams.get('env') === 'staging' ? 'staging' : 'prod';
    const prefix = appEnv === 'staging' ? 's/' : '';

    if (p === '/app/manifest') {
      const rows = appEnv === 'staging'
        ? await env.DB.prepare("SELECT path, hash FROM app_files WHERE path LIKE 's/%'").all()
        : await env.DB.prepare("SELECT path, hash FROM app_files WHERE path NOT LIKE 's/%'").all();
      const metaVersionKey = appEnv === 'staging' ? 'version:staging' : 'version';
      const meta = await env.DB.prepare('SELECT value FROM app_meta WHERE key = ?').bind(metaVersionKey).first();
      /* 桌面版只吃 files；m/ 開頭是手機版（由 /m/ 直接供應），桌面版不必抓 */
      const files = {};
      const mobile = {};
      for (const r of rows.results || []) {
        const key = prefix ? String(r.path).slice(prefix.length) : String(r.path);
        if (String(key).startsWith('m/')) mobile[key] = r.hash;
        else files[key] = r.hash;
      }
      return json({ ok: true, version: (meta && meta.value) || '', files, mobile });
    }

    if (p === '/app/file') {
      const key = url.searchParams.get('p') || '';
      if (!key) return json({ ok: false, error: '缺 p' }, 400);
      try {
        const row = await env.DB.prepare('SELECT body FROM app_files WHERE path = ?').bind(prefix + key).first();
        if (!row) return json({ ok: false, error: 'not found: ' + key }, 404);
        return new Response(b64Bytes(row.body), {
          headers: { 'content-type': fileType(key), 'cache-control': 'no-cache' },
        });
      } catch (e) {
        return json({ ok: false, error: 'app/file 失敗：' + key + ' → ' + (e && e.message) }, 500);
      }
    }

    if (!authed(req, env)) return json({ ok: false, error: 'unauthorized' }, 401);

    /* ══ 鏡像站（瀏覽器模式）用的 API ══
       ui/bridge-http.js 用同一個 Bearer token（網址 #t=）呼叫；
       桌面專屬的功能一律回 501 JSON，讓 ui 的 try/catch 接得住，不 500、不整頁炸。 */
    if (p === '/api/health') return json({ ok: true, mode: 'http' });

    if (p === '/api/config') {
      if (req.method === 'POST') return desktopOnly('寫入設定');
      return json({
        theme: 'claude-code',
        streamSpeed: 45,
        modelName: 'opus 4.5 · 中',
        fontScale: 1,
        windowTitle: 'api-server — node — 120×36',
        loggedIn: !!(await getCookie(env)),
        dataDir: '',
        mode: 'http',
      });
    }

    if (p === '/api/version') {
      return json({ ok: true, sha: 'cloud', branch: 'mirror', mode: 'http', dataDir: '' });
    }

    /* 上次讀的那本：雲端進度表最新一筆；沒有就 null（跟 server.js 的 last-book.json 一樣） */
    if (p === '/api/last-book') {
      try {
        const row = await env.DB.prepare('SELECT * FROM progress ORDER BY updated_at DESC LIMIT 1').first();
        if (!row) return json(null);
        return json({
          id: row.book_id,
          title: row.title || '',
          chapter_id: row.chapter_id || '',
          chapter_no: row.chapter_no || '',
          updated_at: row.updated_at || 0,
        });
      } catch { return json(null); }
    }

    /* 書評在鏡像站先回空（不假裝有資料，面板會顯示沒有） */
    if (p === '/api/comments') {
      return json({ ok: true, comments: [], total: 0, cursor: '', hasMore: false });
    }

    /* 閱讀統計在鏡像站只回空表（本機的 stats.json 不在雲端） */
    if (p === '/api/stats') {
      if (req.method === 'POST') return desktopOnly('閱讀統計寫入');
      return json({
        ok: true,
        today: { chars: 0, chapters: 0, seconds: 0 },
        last7: [],
        total: { chars: 0, chapters: 0, seconds: 0 },
        days: 0,
      });
    }

    /* 桌面專屬：回明確的 501，而不是 404/500 */
    if (p === '/api/qr/start' || p === '/api/qr/poll' || p === '/api/login') return desktopOnly('掃碼登入');
    if (p === '/api/cookie') return desktopOnly('登入 cookie');
    if (p === '/api/export') return desktopOnly('匯出');
    if (p === '/api/search') return desktopOnly('全文搜尋');
    if (p === '/api/events' || p === '/api/boss') return desktopOnly('老闆鍵');
    if (p === '/api/prefetch' || p.startsWith('/api/prefetch/')) return desktopOnly('預先抓取');
    if (p === '/api/tunnel') return desktopOnly('外網通道');
    if (p === '/api/update' || p === '/api/update/apply') return desktopOnly('熱更新');
    if (p.startsWith('/api/sync/')) return desktopOnly('雲端同步設定');

    /* ── 發佈新版本（Bearer 金鑰；只有桌面版打包腳本會呼叫） ── */
    if (p === '/app/publish' && req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body || !body.version || !Array.isArray(body.files)) {
        return json({ ok: false, error: '需要 { version, files:[{path,hash,body}] }' }, 400);
      }
      /* env=staging 的發佈存到 s/ 前綴：兩個環境互不覆蓋、也互不刪除 */
      const pubEnv = body.env === 'staging' ? 'staging' : 'prod';
      const pubPrefix = pubEnv === 'staging' ? 's/' : '';
      const metaKey = pubEnv === 'staging' ? 'version:staging' : 'version';
      const stmts = [];
      for (const f of body.files) {
        if (!f || !f.path || typeof f.body !== 'string') continue;
        stmts.push(env.DB.prepare(
          `INSERT INTO app_files (path, body, hash, version, updated_at) VALUES (?,?,?,?,?)
           ON CONFLICT(path) DO UPDATE SET
             body=excluded.body, hash=excluded.hash, version=excluded.version, updated_at=excluded.updated_at`,
        ).bind(pubPrefix + String(f.path), f.body, String(f.hash || ''), String(body.version), Date.now()));
      }
      stmts.push(env.DB.prepare(
        `INSERT INTO app_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      ).bind(metaKey, String(body.version)));

      let done = 0;
      for (let i = 0; i < stmts.length; i += 40) {
        const chunk = stmts.slice(i, i + 40);
        await env.DB.batch(chunk);
        done += chunk.length;
      }

      /* 清掉「自己這個環境」已經不存在的檔案 */
      let removed = 0;
      if (Array.isArray(body.keep)) {
        const keep = new Set(body.keep.map(String));
        const rows = pubEnv === 'staging'
          ? await env.DB.prepare("SELECT path FROM app_files WHERE path LIKE 's/%'").all()
          : await env.DB.prepare("SELECT path FROM app_files WHERE path NOT LIKE 's/%'").all();
        for (const r of rows.results || []) {
          const raw = String(r.path);
          const key = pubPrefix ? raw.slice(pubPrefix.length) : raw;
          if (keep.has(key)) continue;
          await env.DB.prepare('DELETE FROM app_files WHERE path = ?').bind(raw).run();
          removed++;
        }
      }
      return json({ ok: true, env: pubEnv, version: body.version, wrote: done, removed });
    }

    /* ── 設定：把登入 cookie 存進來（桌面版呼叫） ── */
    if (p === '/setup' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.cookie !== undefined) {
        await env.DB.prepare(
          'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        ).bind('cookie', String(body.cookie || '')).run();
      }
      return json({ ok: true, hasCookie: !!(body.cookie || await getCookie(env)) });
    }

    if (p === '/setup') {
      const cookie = await getCookie(env);
      return json({ ok: true, hasCookie: !!cookie });
    }

    /* ── 番茄代理（手機用） ── */
    if (p === '/api/shelf') {
      try {
        const r = await getShelf(await getCookie(env));
        return json({ ok: true, ...r });
      } catch (e) {
        return json({ ok: false, error: e.message, books: [], total: 0 });
      }
    }

    if (p === '/api/open') {
      try {
        /* ui 的 bridge-http.js 是 POST JSON { input }；舊手機殼是 GET ?input=，兩種都收 */
        let input = url.searchParams.get('input') || '';
        if (!input && req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          input = b.input || b.bookId || b.book_id || '';
        }
        if (!input) return json({ ok: false, error: '缺 input（書號或書頁網址）' });
        const r = await openBook(input, await getCookie(env));
        return json({ ok: true, ...r });
      } catch (e) {
        return json({ ok: false, error: e.message });
      }
    }

    if (p === '/api/chapter') {
      try {
        const bookId = url.searchParams.get('book') || '';
        const id = url.searchParams.get('id') || '';
        const r = await loadChapter(bookId, id, await getCookie(env));
        return json({ ok: true, ...r });
      } catch (e) {
        return json({ ok: false, error: e.message });
      }
    }

    if (p === '/api/progress') {
      if (req.method === 'POST') {
        const b = await req.json().catch(() => ({}));

        /* 刪除：舊殼用 book_id，ui 用 bookId */
        if (b.action === 'remove') {
          const dropId = String(b.book_id || b.bookId || '');
          if (!dropId) return json({ ok: false, error: '缺 book_id' });
          await env.DB.prepare('DELETE FROM progress WHERE book_id = ?').bind(dropId).run();
          return json({ ok: true, removed: true });
        }

        /* 兩種寫入格式都收：
           ① 單筆 { book_id|bookId, chapter_id|chapterId, chapter_no, title }（舊殼／桌面同步）
           ② ui 的整份文件 { books: { <bookId>: { chapterId, chapterNo, title, updated } }, lastBook }
              （remember.js 把整份 progress.json 丟上來，這裡拆成一列一列） */
        const entries = [];
        if (b.books && typeof b.books === 'object') {
          for (const [bookId, v] of Object.entries(b.books)) {
            if (!v || typeof v !== 'object') continue;
            entries.push({
              book_id: String(bookId),
              chapter_id: v.chapterId || v.chapter_id || '',
              chapter_no: v.chapterNo || v.chapter_no || '',
              title: v.title || '',
              updated_at: Number(v.updated) || Number(v.updated_at) || Date.now(),
            });
          }
        } else {
          const bookId = String(b.book_id || b.bookId || '');
          if (!bookId) return json({ ok: false, error: '缺 book_id（或 books）' });
          entries.push({
            book_id: bookId,
            chapter_id: b.chapter_id || b.chapterId || '',
            chapter_no: b.chapter_no || b.chapterNo || '',
            title: b.title || '',
            updated_at: Number(b.updated_at) || Number(b.updated) || Date.now(),
          });
        }
        if (!entries.length) return json({ ok: false, error: '沒有可寫的進度' });

        const now = Date.now();
        for (const e of entries) {
          await env.DB.prepare(
            `INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(book_id) DO UPDATE SET
               chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
               title=excluded.title, updated_at=excluded.updated_at, device=excluded.device`,
          ).bind(e.book_id, e.chapter_id, e.chapter_no, e.title, e.updated_at, 'phone').run();
        }
        return json({ ok: true, wrote: entries.length, updated_at: now });
      }

      const rows = await env.DB.prepare('SELECT * FROM progress ORDER BY updated_at DESC').all();
      const list = rows.results || [];
      /* 同時回「表格原始列」與「ui 的 progress.json 形狀」，兩邊都不用改 */
      const books = {};
      for (const r of list) {
        books[r.book_id] = {
          chapterId: r.chapter_id || '',
          chapterNo: r.chapter_no || '',
          title: r.title || '',
          updated: r.updated_at || 0,
        };
      }
      const lastBook = list.length ? list[0].book_id : null;
      return json({ ok: true, progress: list, books, lastBook });
    }

    if (p === '/api/marks') {
      if (req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const now = Date.now();

        /* ui 的 bridge-http.js 傳 camelCase（bookId/chapterId/chapterTitle），舊殼是 snake_case */
        const bookId = String(b.book_id || b.bookId || '');
        const chapterId = b.chapter_id || b.chapterId || '';
        const chapterTitle = b.chapter_title || b.chapterTitle || '';

        if (b.action === 'remove') {
          if (!b.id) return json({ ok: false, error: '缺 id' });
          await env.DB.prepare('UPDATE marks SET deleted=1, updated_at=? WHERE id=?')
            .bind(now, String(b.id)).run();
          return json({ ok: true, removed: true });
        }
        if (!bookId) return json({ ok: false, error: '缺 book_id' });

        const id = b.id || (chapterId + '-' + (Number(b.para) || 0) + '-' + (b.type || 'highlight'));
        await env.DB.prepare(
          `INSERT INTO marks (id, book_id, chapter_id, chapter_title, para, text, note, type, updated_at, device, deleted)
           VALUES (?,?,?,?,?,?,?,?,?,?,0)
           ON CONFLICT(id) DO UPDATE SET
             text=excluded.text, note=excluded.note, para=excluded.para,
             deleted=0, updated_at=excluded.updated_at, device=excluded.device`,
        ).bind(String(id), bookId, chapterId, chapterTitle,
          Number(b.para) || 0, b.text || '', b.note || '', b.type || 'highlight', now, 'phone').run();
        return json({ ok: true, id });
      }
      const bookId = url.searchParams.get('book');
      const rows = bookId
        ? await env.DB.prepare('SELECT * FROM marks WHERE book_id = ? ORDER BY updated_at').bind(bookId).all()
        : await env.DB.prepare('SELECT * FROM marks ORDER BY updated_at').all();
      /* 表格是 snake_case，ui（wiring4.js）讀 camelCase → 兩種都給，省掉一邊改 */
      const marks = (rows.results || []).map((m) => ({
        ...m,
        bookId: m.book_id,
        chapterId: m.chapter_id,
        chapterTitle: m.chapter_title,
        updatedAt: m.updated_at,
      }));
      return json({ ok: true, marks });
    }

    /* ── 同步（桌面版） ── */
    if (p === '/push' && req.method === 'POST') {
      const body = await req.json();
      const device = String(body.device || 'unknown').slice(0, 40);
      const force = body.force === true;   // 以本機為準（救援用）
      const now = Date.now();
      let n = 0;

      for (const pr of body.progress || []) {
        if (!pr.book_id) continue;
        const prSql = force
          ? `INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(book_id) DO UPDATE SET
               chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
               title=excluded.title, updated_at=excluded.updated_at, device=excluded.device`
          : `INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(book_id) DO UPDATE SET
               chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
               title=excluded.title, updated_at=excluded.updated_at, device=excluded.device
             WHERE excluded.updated_at > progress.updated_at`;
        await env.DB.prepare(prSql).bind(pr.book_id, pr.chapter_id || '', pr.chapter_no || '',
          pr.title || '', Number(pr.updated_at) || now, device).run();
        n++;
      }

      for (const m of body.marks || []) {
        if (!m.id || !m.book_id) continue;
        await env.DB.prepare(
          `INSERT INTO marks (id, book_id, chapter_id, chapter_title, para, text, note, type, updated_at, device, deleted)
           VALUES (?,?,?,?,?,?,?,?,?,?,0)
           ON CONFLICT(id) DO UPDATE SET
             note=excluded.note, text=excluded.text, deleted=0,
             updated_at=excluded.updated_at, device=excluded.device
           WHERE excluded.updated_at > marks.updated_at`,
        ).bind(m.id, m.book_id, m.chapter_id || '', m.chapter_title || '',
          Number(m.para) || 0, m.text || '', m.note || '', m.type || 'highlight',
          Number(m.updated_at) || now, device).run();
        n++;
      }

      for (const id of body.deletedMarks || []) {
        await env.DB.prepare('UPDATE marks SET deleted=1, updated_at=? WHERE id=?').bind(now, id).run();
        n++;
      }

      return json({ ok: true, applied: n });
    }

    if (p === '/pull') {
      const since = Number(url.searchParams.get('since') || 0);
      const prog = await env.DB.prepare(
        'SELECT * FROM progress WHERE updated_at > ? ORDER BY updated_at',
      ).bind(since).all();
      const marks = await env.DB.prepare(
        'SELECT * FROM marks WHERE updated_at > ? ORDER BY updated_at',
      ).bind(since).all();
      return json({
        ok: true,
        serverTime: Date.now(),
        progress: prog.results || [],
        marks: marks.results || [],
      });
    }

    if (p.startsWith('/api/')) return json({ ok: false, error: 'not found: ' + p }, 404);
    return json({ ok: false, error: 'not found' }, 404);
  },
};
