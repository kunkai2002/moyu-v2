// 全書搜尋（/grep）：章節標題 + 已快取正文；把這個假功能做成真的
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── src/search.js ───────────────────────────────────────── */
{
  const src = `'use strict';

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
    const joined = rec.paragraphs.join('\\n');
    if (!joined.toLowerCase().includes(lc)) continue;
    const ch = chapters.find((c) => c.id === rec.chapterId);
    hits.push({
      chapterId: rec.chapterId,
      no: ch ? ch.no : '',
      title: rec.title || (ch && ch.title) || '',
      where: 'body',
      snippet: snippet(joined.replace(/\\n/g, ' '), query, 26),
    });
  }

  const order = new Map(chapters.map((c, i) => [String(c.id), i]));
  hits.sort((a, b) => (order.get(String(a.chapterId)) ?? 99999) - (order.get(String(b.chapterId)) ?? 99999));

  return { ok: true, hits, total: hits.length, cached: files.length, scanned };
}

module.exports = { search };
`;
  fs.writeFileSync(p('src/search.js'), src, 'utf8');
  console.log('src/search.js ok');
}

/* ── server.js：/api/search ──────────────────────────────── */
{
  const f = p('server.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("'/api/search'")) {
    must(s, "    if (p === '/api/marks') {", 'server marks route');
    s = s.replace(
      "    if (p === '/api/marks') {",
      `    if (p === '/api/search') {
      const bookId = u.searchParams.get('book') || '';
      const q = u.searchParams.get('q') || '';
      try {
        return json(res, 200, { ...searchInBook(DATA_DIR, bookId, q, 40) });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message, hits: [], total: 0 });
      }
    }

    if (p === '/api/marks') {`
    );
    must(s, "const { searchBooks } = require('./src/booksearch');", 'server booksearch require');
    s = s.replace(
      "const { searchBooks } = require('./src/booksearch');",
      "const { searchBooks } = require('./src/booksearch');\nconst { search: searchInBook } = require('./src/search');"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('server.js ok');
  } else console.log('server.js 已有 /api/search');
}

/* ── main.js：search:query ───────────────────────────────── */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('search:query')) {
    must(s, "  ipcMain.handle('marks:list', (_e, bookId) => {", 'main marks:list');
    s = s.replace(
      "  ipcMain.handle('marks:list', (_e, bookId) => {",
      `  ipcMain.handle('search:query', (_e, payload) => {
    try {
      const { bookId, q } = payload || {};
      return searchInBook(DATA_DIR, bookId, q, 40);
    } catch (e) { return { ok: false, error: e.message, hits: [], total: 0 }; }
  });

  ipcMain.handle('marks:list', (_e, bookId) => {`
    );
    must(s, "const appapi = require('./src/appapi');", 'main appapi require');
    s = s.replace(
      "const appapi = require('./src/appapi');",
      "const appapi = require('./src/appapi');\nconst { search: searchInBook } = require('./src/search');"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js ok');
  } else console.log('main.js 已有 search:query');
}

/* ── preload.js ──────────────────────────────────────────── */
{
  const f = p('ui/preload.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('search:')) {
    must(s, "  marks: {", 'preload marks');
    s = s.replace(
      "  marks: {",
      "  search: (bookId, q) => ipcRenderer.invoke('search:query', { bookId, q }),\n  marks: {"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('preload.js ok');
  } else console.log('preload.js 已有 search');
}

/* ── app.js：searchInBook 實作 ───────────────────────────── */
{
  const f = p('ui/app.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('async function searchInBook')) {
    must(s, 'window.__moyuDebug = {', 'app debug');
    const impl = [
      '',
      '/* ──────────────────────────────────────────────────────────────',
      '   全書搜尋：章節標題 + 已讀過的正文',
      '   ────────────────────────────────────────────────────────────── */',
      'async function searchInBook(q) {',
      '  const query = String(q || "").trim();',
      '  if (!query) return;',
      "  if (!state.book) { addError('先開一本書再搜尋'); return; }",
      '  addUser(`搜尋「${query}」`);',
      '  const b = addAssistant();',
      "  b.insertAdjacentHTML('beforeend',",
      '    `<div class="tool">⏺ <span class="fn">grep</span>("${escapeHtml(query)}")</div>` +',
      "    '<div class=\"toolres\" id=\"searchRes\"><div class=\"ln\"><span class=\"bar\">⎿</span><div>搜尋中…</div></div></div>');",
      "  const box = b.querySelector('#searchRes');",
      '  let r = null;',
      '  try { r = await bridge.search?.(state.book.id, query); }',
      '  catch (e) { r = { ok: false, error: e.message }; }',
      '  if (!r || r.ok === false) {',
      '    box.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>${escapeHtml((r && r.error) || "搜尋失敗")}</div></div>`;',
      '    return;',
      '  }',
      '  const hits = r.hits || [];',
      '  if (!hits.length) {',
      '    box.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>沒有找到「${escapeHtml(query)}」。正文只搜已讀過的章節。</div></div>`;',
      '    scrollBottom();',
      '    return;',
      '  }',
      '  box.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>${hits.length} 個結果（正文掃了 ${r.scanned || 0} 個已讀章節）</div></div>`;',
      "  const list = el('div', 'search-hits');",
      '  for (const h of hits) {',
      "    const row = el('button', 'search-hit');",
      '    row.innerHTML = `<span class="sh-t">第 ${escapeHtml(String(h.no || "?"))} 章 ${escapeHtml(h.title || "")}</span>` +',
      '      `<span class="sh-x">${escapeHtml(h.snippet || "")}</span>` +',
      '      `<span class="sh-k">${h.where === "title" ? "標題" : "正文"}</span>`;',
      "    row.addEventListener('click', () => {",
      '      const i = state.chapters.findIndex((c) => String(c.id) === String(h.chapterId));',
      '      if (i >= 0) goChapter(i, { announce: true });',
      '    });',
      '    list.appendChild(row);',
      '  }',
      '  box.appendChild(list);',
      '  scrollBottom();',
      '}',
      '',
      '',
    ].join('\n');
    s = s.replace('window.__moyuDebug = {', impl + 'window.__moyuDebug = {');
    fs.writeFileSync(f, s, 'utf8');
    console.log('app.js ok');
  } else console.log('app.js 已有 searchInBook');
}

/* ── pack4 ───────────────────────────────────────────────── */
{
  const f = p('tools/pack4.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("'src/search.js'")) {
    must(s, "'src/booksearch.js'", 'pack booksearch');
    s = s.replace("'src/booksearch.js'", "'src/booksearch.js', 'src/search.js'");
    fs.writeFileSync(f, s, 'utf8');
    console.log('pack4.js ok');
  } else console.log('pack4.js 已有 search.js');
}
