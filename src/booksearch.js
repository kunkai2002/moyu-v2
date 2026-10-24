'use strict';

/* 書名搜尋：走 APP 網關 /bookapi/search/tab/v
   cell.show_type=110 才是真正的書；其餘是推薦/熱搜插入位。 */

const api = require('./appapi');

const RESULT_SHOW_TYPE = 110;

async function searchBooks(query, tabType = 1, passback = 0) {
  const q = String(query || '').trim();
  if (!q) throw new Error('缺關鍵字');

  const j = await api.appGet('/bookapi/search/tab/v', {
    query: q,
    passback: String(passback),
    selected_items: '',
    tab_type: String(tabType),
  });

  if (j?.code !== undefined && j.code !== 0) {
    throw new Error(j.message || `搜尋失敗(code=${j.code})`);
  }

  const tabs = Array.isArray(j?.search_tabs) ? j.search_tabs : [];
  const cur = tabs.find((t) => Number(t?.tab_type) === tabType) || tabs[0];
  const cells = Array.isArray(cur?.data) ? cur.data : [];

  const books = [];
  const seen = new Set();
  const push = (raw) => {
    const id = String(raw?.book_id ?? '');
    if (!id || id === '0' || seen.has(id)) return;
    seen.add(id);
    const cover = String(raw?.thumb_url || raw?.audio_thumb_url_hd || '');
    books.push({
      id,
      title: raw?.book_name || raw?.original_book_name || '',
      author: raw?.author || '',
      cover: cover.startsWith('//') ? 'https:' + cover : cover,
      summary: String(raw?.abstract || ''),
      sub: String(raw?.sub_info || ''),
      score: Number(raw?.score) > 0 ? String(raw.score) : '',
      chapters: Number(raw?.serial_count) || 0,
    });
  };

  const results = cells.filter((c) => Number(c?.show_type) === RESULT_SHOW_TYPE);
  if (results.length) {
    for (const c of results) for (const b of c?.book_data || []) push(b);
  } else {
    for (const c of cells) {
      if (Array.isArray(c?.book_data) && c.book_data.length) for (const b of c.book_data) push(b);
    }
  }

  return {
    books: books.slice(0, 30),
    hasMore: Boolean(cur?.has_more) && books.length > 0,
    passback: Number(cur?.passback) || passback + Math.max(books.length, 1),
    tabs: tabs.map((t) => ({ type: Number(t?.tab_type) || 0, name: String(t?.title || '') })).filter((t) => t.name),
  };
}

module.exports = { searchBooks };
