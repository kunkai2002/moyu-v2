'use strict';

/* 書架：同源網頁 API（需要登入 cookie）
   ─────────────────────────────────────────────────────────────
   /reading/bookapi/bookshelf/info   → 書架上的 book_id
   /api/reader/book/progress         → 每本讀到哪
   /api/reading/bookshelf/multidetail → 書名 / 封面 / 作者 / 進度章節
   ══════════════════════════════════════════════════════════════ */

const https = require('https');
const zlib = require('zlib');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ORIGIN = 'https://fanqienovel.com';
const Q = 'aid=1967&iid=0&version_code=57700&update_version_code=57700';

function call(method, url, cookie, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = {
      'User-Agent': UA,
      Referer: ORIGIN + '/',
      Accept: 'application/json, text/plain, */*',
      Cookie: cookie || '',
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = data.length;
    }
    const req = https.request(url, { method, headers }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        let b = Buffer.concat(c);
        if ((res.headers['content-encoding'] || '').includes('gzip')) {
          try { b = zlib.gunzipSync(b); } catch {}
        }
        let json = null;
        try { json = JSON.parse(b.toString('utf8')); } catch {}
        resolve({ status: res.statusCode, json, text: b.toString('utf8') });
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('書架接口逾時')));
    if (data) req.write(data);
    req.end();
  });
}

const norm = (u) => (u.startsWith('//') ? 'https:' + u : u);

/** 取書架（含封面、作者、讀到第幾章） */
async function getShelf(cookie) {
  if (!cookie) throw new Error('還沒登入（打 /login 掃碼）');

  const r1 = await call('GET', `${ORIGIN}/reading/bookapi/bookshelf/info/v:version/?${Q}`, cookie);
  const list = r1.json?.data?.book_shelf_info;
  if (!Array.isArray(list)) {
    // 沒登入或 cookie 過期
    if (r1.status === 401 || r1.json?.code) throw new Error('登入態失效，打 /login 重新掃碼');
    throw new Error(`書架接口回非預期：${r1.text.slice(0, 80)}`);
  }
  if (!list.length) return { books: [], total: 0 };

  const r2 = await call('GET', `${ORIGIN}/api/reader/book/progress`, cookie);
  const progress = Array.isArray(r2.json?.data) ? r2.json.data : [];

  const items = list.map((it) => {
    const p = progress.find((x) => String(x.book_id) === String(it.book_id));
    return {
      id: String(it.book_id),
      group: it.group_name || '',
      chapterId: p ? String(p.item_id) : '0',
      readAt: p ? Number(p.read_timestamp) || 0 : 0,
      addedAt: Number(it.add_shelf_time) || 0,
    };
  });

  // 補書名 / 封面 / 讀到哪一章
  try {
    const r3 = await call('POST', `${ORIGIN}/api/bookshelf/multidetail`, cookie, {
      books: items.map((b) => ({ book_id: b.id, item_id: b.chapterId })),
    });
    const details = r3.json?.data?.detail_list;
    if (Array.isArray(details)) {
      for (const it of items) {
        const d = details.find((x) => String(x.book_id) === String(it.id));
        if (!d) continue;
        it.title = d.book_name || '';
        it.author = d.author_name || '';
        it.cover = norm(d.thumb_url || '');
        it.chapterTitle = d.item_show_title || '';
        it.chapterOrder = d.real_chapter_order || 0;
        it.totalChapters = d.serial_count || 0;
        it.summary = d.abstract || '';
        it.finished = d.update_stop === '1';
      }
    }
  } catch { /* 沒有細節也照樣列書 */ }

  return {
    books: items.filter((b) => b.title),
    total: items.length,
  };
}

module.exports = { getShelf };
