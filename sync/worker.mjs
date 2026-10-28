/**
 * 魔芋一夏 · 後端（Cloudflare Worker + D1）
 *
 * 兩件事：
 *   1. 同步：進度 / 標記（Bearer SYNC_TOKEN）
 *   2. 手機版 PWA：/m/ 靜態頁 + 番茄代理 API（同一把金鑰）
 *
 * 部署：
 *   npx wrangler d1 execute moyu-sync --file=./schema.sql --remote
 *   npx wrangler secret put SYNC_TOKEN
 *   npx wrangler deploy
 */

import { ASSETS, TYPES } from './m-assets.mjs';
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

function asset(pathname) {
  const body = ASSETS[pathname];
  if (body === undefined || body === null) return null;
  return new Response(body, {
    headers: {
      'content-type': TYPES[ext(pathname)] || (pathname.charAt(pathname.length - 1) === '/' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'),
      'cache-control': 'public, max-age=60',
    },
  });
}

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

    /* ── 手機版靜態頁（不需要金鑰，金鑰在網址 fragment 裡） ── */
    if (p === '/favicon.ico') return Response.redirect(url.origin + '/m/icon.svg', 302);
    if (p === '/m') return Response.redirect(url.origin + '/m/', 302);
    if (p.startsWith('/m/')) {
      /* 先看雲端發佈的版本（改完 m/* 不用再 wrangler deploy），沒有才回打包進 Worker 的 */
      const key = p === '/m/' ? 'm/index.html' : p.slice(1);
      try {
        const row = await env.DB.prepare('SELECT body FROM app_files WHERE path = ?').bind(key).first();
        if (row && row.body != null) {
          return new Response(b64Bytes(row.body), {
            headers: { 'content-type': fileType(key), 'cache-control': 'no-cache' },
          });
        }
      } catch {}
      const hit = asset(p);
      if (hit) return hit;
      return asset('/m/') || json({ ok: false, error: 'not found' }, 404);
    }

    /* ── 應用程式熱更新：清單與單檔（公開，內容跟 GitHub 公開版一樣） ── */
    if (p === '/app/manifest') {
      const rows = await env.DB.prepare('SELECT path, hash FROM app_files').all();
      const meta = await env.DB.prepare("SELECT value FROM app_meta WHERE key = 'version'").first();
      /* 桌面版只吃 files；m/ 開頭是手機版（由 /m/ 直接供應），桌面版不必抓 */
      const files = {};
      const mobile = {};
      for (const r of rows.results || []) {
        if (String(r.path).startsWith('m/')) mobile[r.path] = r.hash;
        else files[r.path] = r.hash;
      }
      return json({ ok: true, version: (meta && meta.value) || '', files, mobile });
    }

    if (p === '/app/file') {
      const key = url.searchParams.get('p') || '';
      if (!key) return json({ ok: false, error: '缺 p' }, 400);
      try {
        const row = await env.DB.prepare('SELECT body FROM app_files WHERE path = ?').bind(key).first();
        if (!row) return json({ ok: false, error: 'not found: ' + key }, 404);
        return new Response(b64Bytes(row.body), {
          headers: { 'content-type': fileType(key), 'cache-control': 'no-cache' },
        });
      } catch (e) {
        return json({ ok: false, error: 'app/file 失敗：' + key + ' → ' + (e && e.message) }, 500);
      }
    }

    if (!authed(req, env)) return json({ ok: false, error: 'unauthorized' }, 401);

    /* ── 發佈新版本（Bearer 金鑰；只有桌面版打包腳本會呼叫） ── */
    if (p === '/app/publish' && req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body || !body.version || !Array.isArray(body.files)) {
        return json({ ok: false, error: '需要 { version, files:[{path,hash,body}] }' }, 400);
      }
      const stmts = [];
      for (const f of body.files) {
        if (!f || !f.path || typeof f.body !== 'string') continue;
        stmts.push(env.DB.prepare(
          `INSERT INTO app_files (path, body, hash, version, updated_at) VALUES (?,?,?,?,?)
           ON CONFLICT(path) DO UPDATE SET
             body=excluded.body, hash=excluded.hash, version=excluded.version, updated_at=excluded.updated_at`,
        ).bind(String(f.path), f.body, String(f.hash || ''), String(body.version), Date.now()));
      }
      stmts.push(env.DB.prepare(
        `INSERT INTO app_meta (key, value) VALUES ('version', ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      ).bind(String(body.version)));

      let done = 0;
      for (let i = 0; i < stmts.length; i += 40) {
        const chunk = stmts.slice(i, i + 40);
        await env.DB.batch(chunk);
        done += chunk.length;
      }

      /* 清掉已經不存在的檔案 */
      let removed = 0;
      if (Array.isArray(body.keep)) {
        const keep = new Set(body.keep.map(String));
        const rows = await env.DB.prepare('SELECT path FROM app_files').all();
        const gone = (rows.results || []).map((r) => r.path).filter((x) => !keep.has(x));
        for (const x of gone) {
          await env.DB.prepare('DELETE FROM app_files WHERE path = ?').bind(x).run();
          removed++;
        }
      }
      return json({ ok: true, version: body.version, wrote: done, removed });
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
        const input = url.searchParams.get('input') || '';
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
        if (b.action === 'remove') {
          if (!b.book_id) return json({ ok: false, error: '缺 book_id' });
          await env.DB.prepare('DELETE FROM progress WHERE book_id = ?').bind(String(b.book_id)).run();
          return json({ ok: true, removed: true });
        }
        if (!b.book_id) return json({ ok: false, error: '缺 book_id' });
        const now = Date.now();
        await env.DB.prepare(
          `INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(book_id) DO UPDATE SET
             chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
             title=excluded.title, updated_at=excluded.updated_at, device=excluded.device`,
        ).bind(String(b.book_id), b.chapter_id || '', b.chapter_no || '',
          b.title || '', now, 'phone').run();
        return json({ ok: true, updated_at: now });
      }
      const rows = await env.DB.prepare('SELECT * FROM progress ORDER BY updated_at DESC').all();
      return json({ ok: true, progress: rows.results || [] });
    }

    if (p === '/api/marks') {
      if (req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (!b.book_id) return json({ ok: false, error: '缺 book_id' });
        const now = Date.now();
        if (b.action === 'remove') {
          if (b.id) {
            await env.DB.prepare('UPDATE marks SET deleted=1, updated_at=? WHERE id=?')
              .bind(now, String(b.id)).run();
          }
          return json({ ok: true });
        }
        const id = b.id || (b.chapter_id + '-' + b.para + '-' + (b.type || 'highlight'));
        await env.DB.prepare(
          `INSERT INTO marks (id, book_id, chapter_id, chapter_title, para, text, note, type, updated_at, device, deleted)
           VALUES (?,?,?,?,?,?,?,?,?,?,0)
           ON CONFLICT(id) DO UPDATE SET
             text=excluded.text, note=excluded.note, para=excluded.para,
             deleted=0, updated_at=excluded.updated_at, device=excluded.device`,
        ).bind(String(id), String(b.book_id), b.chapter_id || '', b.chapter_title || '',
          Number(b.para) || 0, b.text || '', b.note || '', b.type || 'highlight', now, 'phone').run();
        return json({ ok: true, id });
      }
      const bookId = url.searchParams.get('book');
      const rows = bookId
        ? await env.DB.prepare('SELECT * FROM marks WHERE book_id = ? ORDER BY updated_at').bind(bookId).all()
        : await env.DB.prepare('SELECT * FROM marks ORDER BY updated_at').all();
      return json({ ok: true, marks: rows.results || [] });
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

    return json({ ok: false, error: 'not found' }, 404);
  },
};
