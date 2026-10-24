/**
 * 魔芋一夏 · 同步後端（Cloudflare Worker + D1）
 *
 * 部署：
 *   1. npx wrangler d1 create moyu-sync
 *   2. 把輸出的 database_id 填進 wrangler.toml
 *   3. npx wrangler d1 execute moyu-sync --file=./schema.sql --remote
 *   4. npx wrangler secret put SYNC_TOKEN      ← 自己取一串長密碼
 *   5. npx wrangler deploy
 *
 * 認證：Authorization: Bearer <SYNC_TOKEN>
 */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

function authed(req, env) {
  const h = req.headers.get('authorization') || '';
  const tok = h.replace(/^Bearer\s+/i, '');
  return !!env.SYNC_TOKEN && tok === env.SYNC_TOKEN;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === '/health') return json({ ok: true, service: 'moyu-sync' });
    if (!authed(req, env)) return json({ ok: false, error: 'unauthorized' }, 401);

    /* ── 推送本機變更 ── */
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
        await env.DB.prepare(
          'UPDATE marks SET deleted=1, updated_at=? WHERE id=?',
        ).bind(now, id).run();
        n++;
      }

      return json({ ok: true, applied: n });
    }

    /* ── 拉取全部（合併交給客戶端）── */
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
