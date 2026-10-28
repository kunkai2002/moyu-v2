// 把舊的 /api/search 換成新版（吃 book 參數、含章節標題、回 no/snippet）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const f = p('server.js');
let s = fs.readFileSync(f, 'utf8');

const startMark = "    if (p === '/api/search' && req.method === 'GET') {";
const endMark = "      return json(res, 200, { ok: true, q, hits, searched: files.length });\n    }";
const i = s.indexOf(startMark);
const j = s.indexOf(endMark, i);
if (i < 0 || j < 0) { console.error('❌ 找不到舊的 search 區塊'); process.exit(1); }

const replacement = `    if (p === '/api/search' && req.method === 'GET') {
      const bookId = u.searchParams.get('book') || '';
      const q = (u.searchParams.get('q') || '').trim();
      if (!q) return json(res, 400, { ok: false, error: '缺 q' });
      try {
        return json(res, 200, searchInBook(DATA_DIR, bookId, q, 40));
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message, hits: [], total: 0 });
      }
    }`;

s = s.slice(0, i) + replacement + s.slice(j + endMark.length);

if (!s.includes("const { search: searchInBook }")) {
  s = s.replace(
    "const { searchBooks } = require('./src/booksearch');",
    "const { searchBooks } = require('./src/booksearch');\nconst { search: searchInBook } = require('./src/search');"
  );
}

fs.writeFileSync(f, s, 'utf8');
console.log('server.js 搜尋路由已更新');
