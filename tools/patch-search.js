// 第一批：全書搜尋（伺服器端 + UI 指令 + bridge）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 1. server.js 加 /api/search ── */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes("'/api/search'")) {
  const anchor = "    if (p === '/api/health') {";
  const route = `    if (p === '/api/search' && req.method === 'GET') {
      const q = (u.searchParams.get('q') || '').trim();
      if (!q) return json(res, 400, { error: '缺 q' });
      const dir = path.join(DATA_DIR, 'chapters');
      let files = [];
      try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch {}
      const hits = [];
      for (const f of files) {
        const ch = store.readJson(path.join(dir, f), null);
        if (!ch || !Array.isArray(ch.paragraphs)) continue;
        ch.paragraphs.forEach((t, i) => {
          const at = t.indexOf(q);
          if (at >= 0 && hits.length < 100) {
            hits.push({
              chapterId: ch.chapterId,
              title: ch.title || '',
              para: i + 1,
              text: t.slice(Math.max(0, at - 16), at + q.length + 16),
            });
          }
        });
        if (hits.length >= 100) break;
      }
      return json(res, 200, { ok: true, q, hits, searched: files.length });
    }

${anchor}`;
  if (s.includes(anchor)) { s = s.replace(anchor, route); fs.writeFileSync(sp, s, 'utf8'); console.log('+ /api/search'); }
  else console.log('! server 錨點沒中');
} else console.log('= /api/search 已存在');

/* ── 2. bridge-http.js 加 search ── */
const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('search:')) {
  b = b.replace(
    "    openBook: (input) => post('/api/open', { input }),",
    "    openBook: (input) => post('/api/open', { input }),\n    search: (bookId, q) => api(`/api/search?book=${encodeURIComponent(bookId)}&q=${encodeURIComponent(q)}`),",
  );
  fs.writeFileSync(bp, b, 'utf8');
  console.log('+ bridge.search');
} else console.log('= bridge.search 已存在');

/* ── 3. app.js 加 /grep 指令 ── */
const ap = path.join(ROOT, 'ui', 'app.js');
let a = fs.readFileSync(ap, 'utf8');
if (!a.includes('searchInBook')) {
  a = a.replace(
    '/* ──────────────────────────────────────────────────────────────\n   書評：包成 tool-call 卡片',
    `/* ──────────────────────────────────────────────────────────────
   全書搜尋（只搜已快取的章節）
   ────────────────────────────────────────────────────────────── */
async function searchInBook(q) {
  if (!state.book) { addError('先開一本書'); return; }
  if (!bridge?.search) { addError('這個模式不支援搜尋'); return; }
  addUser('/grep ' + q);
  const b = addAssistant();
  b.insertAdjacentHTML('beforeend',
    \`<div class="tool">⏺ <span class="fn">grep</span>(<span class="fn">\${escapeHtml(q)}</span>)</div>
     <div class="toolres"><div class="ln"><span class="bar">⎿</span><div>搜尋已快取章節…</div></div></div>\`);
  let r;
  try { r = await bridge.search(state.book.id, q); }
  catch (e) { b.querySelector('.toolres').innerHTML = \`<div class="ln"><span class="bar">⎿</span><div>\${escapeHtml(e.message)}</div></div>\`; return; }

  const res = b.querySelector('.toolres');
  if (!r.hits.length) {
    res.innerHTML = \`<div class="ln"><span class="bar">⎿</span><div>在 \${r.searched} 個已快取章節中找不到「\${escapeHtml(q)}」</div></div>\`;
    return;
  }
  res.innerHTML = \`<div class="ln"><span class="bar">⎿</span><div>\${r.hits.length} 處（掃了 \${r.searched} 章）</div></div>\`;
  const wrap = el('div', 'grep-list');
  for (const h of r.hits) {
    const row = el('button', 'grep-row');
    row.innerHTML = \`<span class="gr-t">\${escapeHtml(h.title)}</span>
      <span class="gr-x">…\${escapeHtml(h.text)}…</span>\`;
    row.addEventListener('click', () => {
      const idx = state.chapters.findIndex((c) => c.id === h.chapterId);
      if (idx >= 0) goChapter(idx, { announce: true });
    });
    wrap.appendChild(row);
  }
  b.appendChild(wrap);
  scrollBottom();
}

/* ──────────────────────────────────────────────────────────────
   書評：包成 tool-call 卡片`,
  );
  // 指令分流
  a = a.replace(
    "  if (/^\\/boss$/i.test(text))",
    "  if (/^\\/grep\\s+/i.test(text)) { searchInBook(text.replace(/^\\/grep\\s+/i, '').trim()); return; }\n  if (/^\\/boss$/i.test(text))",
  );
  fs.writeFileSync(ap, a, 'utf8');
  console.log('+ /grep 指令');
} else console.log('= /grep 已存在');
