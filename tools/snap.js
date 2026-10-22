// 用真實抓下來的書／章節，產生可直接截圖的靜態快照
const fs = require('fs');
const path = require('path');
const fanqie = require('../src/fanqie');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'ui', '_shot');
fanqie.setCharsetPath(path.join(ROOT, 'src', 'charset.json'));

const BOOK = process.argv[2] || '7373660003258862617';
const THEMES = ['claude-code', 'claude', 'vscode', 'excel', 'terminal', 'word'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  console.log('抓書…');
  const { book } = await fanqie.openBook(BOOK, '');
  console.log('  書名', book.title, '｜', book.total, '章');

  const ch = book.chapters[0];
  console.log('抓章…', ch.title);
  const chapter = await fanqie.loadChapter(book.id, ch.id, '');
  console.log('  ', chapter.paragraphs.length, '段', chapter.chars, '字');

  const payload = { book, chapter };
  fs.writeFileSync(path.join(OUT, 'payload.json'), JSON.stringify(payload), 'utf8');

  const uiHtml = fs.readFileSync(path.join(ROOT, 'ui', 'index.html'), 'utf8');

  for (const t of THEMES) {
    const stub = `<script>
      window.__PAYLOAD = ${JSON.stringify(payload)};
      window.moyu = {
        mode: 'snap',
        config: { get: async () => ({ theme: ${JSON.stringify(t)}, streamSpeed: 9000, modelName: 'opus 4.5 · 中' }), set: async () => ({}) },
        login: async () => ({ ok: true }),
        shelf: { list: async () => [], cached: async () => [] },
        openBook: async () => window.__PAYLOAD,
        loadChapter: async () => window.__PAYLOAD.chapter,
        progress: { get: async () => ({ books: {} }), set: async () => true },
        cookie: { set: async () => ({ ok: true }), get: async () => ({}) },
        copy: async () => true,
        boss: async (o) => true,
        hide: async () => true,
        quit: async () => {},
        onBoss: () => {},
      };
      window.__snap = () => window.__moyuDebug.openBook(window.__PAYLOAD.book.id);
    </script>`;

    let html = uiHtml
      .replace('href="theme.css"', 'href="../theme.css"')
      .replace('<script src="bridge-http.js"></script>', '<script src="../bridge-http.js"></script>')
      .replace('<script src="app.js"></script>', stub + '<script src="../app.js"></script>')
      .replace(/data-theme="[^"]*"/, `data-theme="${t}"`);

    // 載入後自動開書
    html = html.replace('</body>',
      `<script>
        window.addEventListener('load', () => setTimeout(() => window.__snap && window.__snap(), 120));
      </script></body>`);

    const f = path.join(OUT, `live-${t}.html`);
    fs.writeFileSync(f, html, 'utf8');
    console.log('wrote', path.basename(f));
  }

  console.log('完成');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
