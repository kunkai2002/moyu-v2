'use strict';

/* 全書搜尋：章節標題 + 已快取章節正文
   （正文只搜已經讀過、存在 data/chapters 的章節；標題則是全書都有） */
const fs = require('fs');
const path = require('path');
const store = require('./store');

function snippet(text, q, pad) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return '';
  const from = Math.max(0, i - (pad || 18));
  const to = Math.min(text.length, i + q.length + (pad || 18));
  return (from > 0 ? '…' : '') + text.slice(from, to) + (to < text.length ? '…' : '');
}

function search(dataDir, bookId, q, limit) {
  const query = String(q || '').trim();
  const max = Math.max(1, Math.min(80, Number(limit) || 40));
  if (!query) return { ok: false, error: '請輸入關鍵字', hits: [], total: 0 };

  const bookFile = path.join(dataDir, 'book-' + bookId + '.json');
  const saved = store.readJson(bookFile, null);
  const book = saved && saved.book ? saved.book : saved;
  const chapters = (book && book.chapters) || [];
  if (!chapters.length) return { ok: false, error: '這本書的目錄還沒載入', hits: [], total: 0 };

  const hits = [];
  const lc = query.toLowerCase();

  /* 1) 章節標題 */
  for (const c of chapters) {
    if ((c.title || '').toLowerCase().includes(lc)) {
      hits.push({
        chapterId: c.id, no: c.no, title: c.title,
        where: 'title', snippet: snippet(c.title, query),
      });
      if (hits.length >= max) break;
    }
  }

  /* 2) 已快取正文 */
  const dir = path.join(dataDir, 'chapters');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch {}
  let scanned = 0;
  for (const f of files) {
    if (hits.length >= max) break;
    const rec = store.readJson(path.join(dir, f), null);
    if (!rec || !Array.isArray(rec.paragraphs)) continue;
    scanned++;
    const joined = rec.paragraphs.join('\n');
    if (!joined.toLowerCase().includes(lc)) continue;
    const ch = chapters.find((c) => c.id === rec.chapterId);
    hits.push({
      chapterId: rec.chapterId,
      no: ch ? ch.no : '',
      title: rec.title || (ch && ch.title) || '',
      where: 'body',
      snippet: snippet(joined.replace(/\n/g, ' '), query, 26),
    });
  }

  const order = new Map(chapters.map((c, i) => [String(c.id), i]));
  hits.sort((a, b) => (order.get(String(a.chapterId)) ?? 99999) - (order.get(String(b.chapterId)) ?? 99999));

  return { ok: true, hits, total: hits.length, cached: files.length, scanned };
}

module.exports = { search };
