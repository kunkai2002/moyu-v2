// 接上 /api/prefetch + 註冊 wiring10
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* server.js */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes("'/api/prefetch'")) {
  s = s.replace(
    "const sync = require('./src/sync');",
    "const sync = require('./src/sync');\nconst prefetch = require('./src/prefetch');",
  );
  const anchor = "    if (p === '/api/health') {";
  const route = `    if (p === '/api/prefetch/status') {
      return json(res, 200, { ok: true, job: prefetch.status() });
    }

    if (p === '/api/prefetch/stop') {
      return json(res, 200, { ok: true, job: prefetch.stop() });
    }

    if (p === '/api/prefetch' && req.method === 'POST') {
      const b = await readBody(req);
      const bookId = String(b.bookId || '');
      if (!bookId) return json(res, 400, { error: '缺 bookId' });
      try {
        let book = store.readJson(path.join(DATA_DIR, 'book-' + bookId + '.json'), null);
        if (!book) {
          const r0 = await fanqie.openBook(bookId, cookie());
          book = r0.book;
          store.writeJson(path.join(DATA_DIR, 'book-' + bookId + '.json'), book);
        }
        return json(res, 200, { ok: true, job: prefetch.start(DATA_DIR, book, cookie()) });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

${anchor}`;
  if (s.includes(anchor)) { s = s.replace(anchor, route); fs.writeFileSync(sp, s, 'utf8'); console.log('+ /api/prefetch'); }
  else console.log('! server 錨點沒中');
}

/* bridge */
const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('prefetch:')) {
  const a1 = '    sync: {';
  const add = [
    '    prefetch: {',
    "      start: (bookId) => post('/api/prefetch', { bookId }),",
    "      status: () => api('/api/prefetch/status'),",
    "      stop: () => post('/api/prefetch/stop', {}),",
    '    },',
    a1,
  ].join('\n');
  if (b.includes(a1)) { fs.writeFileSync(bp, b.replace(a1, add), 'utf8'); console.log('+ bridge.prefetch'); }
  else console.log('! bridge 錨點沒中');
}

/* index.html */
const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring10.js')) {
  h = h.replace('<script src="wiring9.js"></script>',
    '<script src="wiring9.js"></script>\n<script src="wiring10.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring10');
}

/* pack4 */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes("src/prefetch.js")) {
  p = p.replace("'src/sync.js',", "'src/sync.js', 'src/prefetch.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 src/prefetch.js');
}
if (!p.includes('wiring10')) {
  p = p.replace("'ui/wiring9.js',", "'ui/wiring9.js', 'ui/wiring10.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring10');
}
