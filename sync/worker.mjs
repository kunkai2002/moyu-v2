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
    if (p === '/m') return Response.redirect(url.origin + '/m/', 302);
    if (p.startsWith('/m/')) {
      const hit = asset(p);
      if (hit) return hit;
      return asset('/m/') || json({ ok: false, error: 'not found' }, 404);
    }

    if (!authed(req, env)) return json({ ok: false, error: 'unauthorized' }, 401);

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
      const now = Date.now();
      let n = 0;

      for (const pr of body.progress || []) {
        if (!pr.book_id) continue;
        await env.DB.prepare(
          `INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(book_id) DO UPDATE SET
             chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
             title=excluded.title, updated_at=excluded.updated_at, device=excluded.device
           WHERE excluded.updated_at > progress.updated_at`,
        ).bind(pr.book_id, pr.chapter_id || '', pr.chapter_no || '',
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
