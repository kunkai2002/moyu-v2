// 書名搜尋：server 路由 + 手機版 UI + 打包
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 1. server.js ── */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes("'/api/book/search'")) {
  s = s.replace("const prefetch = require('./src/prefetch');",
    "const prefetch = require('./src/prefetch');\nconst { searchBooks } = require('./src/booksearch');");
  const anchor = "    if (p === '/api/health') {";
  const route = `    if (p === '/api/book/search' && req.method === 'GET') {
      const q = (u.searchParams.get('q') || '').trim();
      const tab = Number(u.searchParams.get('tab') || 1);
      const passback = Number(u.searchParams.get('passback') || 0);
      if (!q) return json(res, 400, { error: '缺關鍵字' });
      try {
        const r = await searchBooks(q, tab, passback);
        return json(res, 200, { ok: true, ...r });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message, books: [] });
      }
    }

${anchor}`;
  if (s.includes(anchor)) { fs.writeFileSync(sp, s.replace(anchor, route), 'utf8'); console.log('+ /api/book/search'); }
  else console.log('! server 錨點沒中');
} else console.log('= 已存在');

/* ── 2. 手機版：搜尋結果渲染 ── */
const mp = path.join(ROOT, 'ui', 'm', 'm.js');
let m = fs.readFileSync(mp, 'utf8');
if (!m.includes('renderSearch')) {
  m = m.replace(
    `    state.textContent = '書名搜尋還沒接上，請貼書號或書頁網址。';
    list.innerHTML = '';`,
    `    state.textContent = '搜尋中…';
    list.innerHTML = '';
    try {
      const r = await api('/api/book/search?q=' + encodeURIComponent(v));
      if (!r.ok) { state.textContent = r.error || '搜尋失敗'; return; }
      if (!r.books.length) { state.textContent = '找不到「' + v + '」'; return; }
      state.textContent = '找到 ' + r.books.length + ' 本';
      renderSearch(r.books);
    } catch (err) { state.textContent = '搜尋失敗：' + err.message; }`,
  );

  m = m.replace(
    '  /* ── 掃碼登入 ── */',
    `  function renderSearch(books) {
    const list = $('#searchList');
    list.innerHTML = books.map((b, i) => \`
      <div class="li sr" data-i="\${i}" style="flex-direction:row;gap:12px;align-items:center">
        <div style="width:52px;height:70px;flex:none;border-radius:6px;overflow:hidden;background:#f0e6dc">
          \${b.cover ? \`<img src="\${esc(b.cover)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">\` : ''}
        </div>
        <div style="flex:1;min-width:0">
          <b>\${esc(b.title)}</b>
          <div class="li-sub">\${esc(b.author || '')}\${b.sub ? ' · ' + esc(b.sub) : ''}</div>
          <div class="li-sum">\${esc((b.summary || '').slice(0, 46))}</div>
        </div>
      </div>\`).join('');
    list.querySelectorAll('.sr').forEach((el) => {
      el.addEventListener('click', () => openBook(books[+el.dataset.i]));
    });
  }

  /* ── 掃碼登入 ── */`,
  );
  fs.writeFileSync(mp, m, 'utf8');
  console.log('+ 手機版搜尋結果');
}

/* ── 3. 手機版樣式 ── */
const cp = path.join(ROOT, 'ui', 'm', 'm.css');
let c = fs.readFileSync(cp, 'utf8');
if (!c.includes('.li-sum')) {
  c += `
/* 搜尋結果 */
.li-sub{font-size:11.5px;color:var(--t3);margin-top:2px}
.li-sum{font-size:11.5px;color:#b0b0b8;margin-top:3px;line-height:1.5;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sr:active{background:#00000006}
`;
  fs.writeFileSync(cp, c, 'utf8');
  console.log('+ 搜尋結果樣式');
}

/* ── 4. pack4 ── */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('src/booksearch.js')) {
  p = p.replace("'src/prefetch.js',", "'src/prefetch.js', 'src/booksearch.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 src/booksearch.js');
}
