// 介面快照矩陣：多尺寸 × 多狀態 × 多主題，一次拍完（無頭）
//   node tools/shot-matrix.js            # 全部
//   node tools/shot-matrix.js chat 1440  # 只拍某狀態／某尺寸（模糊比對）
// 產出 _probe/matrix/*.png 與 _probe/matrix/index.json（每張圖的尺寸與關鍵 box）
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(ROOT, '_probe', 'matrix');
const DATA = path.join(ROOT, '_probe', 'matrix-data');
const PORT = 9371;
const BOOK = '7143038691944959011';

const SIZES = [[1440, 900], [1920, 1080], [1280, 800], [1024, 768], [820, 620], [390, 844]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SHOOTS = [
  { id: 'chat', theme: 'dsh', shell: 'dsh', size: [1440, 900], do: null },
  { id: 'chat-1920', theme: 'dsh', shell: 'dsh', size: [1920, 1080] },
  { id: 'chat-1280', theme: 'dsh', shell: 'dsh', size: [1280, 800] },
  { id: 'chat-1024', theme: 'dsh', shell: 'dsh', size: [1024, 768] },
  { id: 'chat-820', theme: 'dsh', shell: 'dsh', size: [820, 620] },
  { id: 'chat-390', theme: 'dsh', shell: 'dsh', size: [390, 844] },
  { id: 'light', theme: 'dsh-light', shell: 'dsh', size: [1440, 900] },
  { id: 'claude-code', theme: 'claude-code', shell: 'dsh', size: [1440, 900] },
  { id: 'word', theme: 'word', shell: 'dsh', size: [1440, 900] },
  { id: 'cc', theme: 'claude-code', shell: 'cc', size: [1440, 900] },
  { id: 'shelf', theme: 'dsh', shell: 'dsh', size: [1440, 900], click: '#saNew' },
  { id: 'settings', theme: 'dsh', shell: 'dsh', size: [1440, 900], click: '#meRow' },
  { id: 'marks', theme: 'dsh', shell: 'dsh', size: [1440, 900], click: '#saPlug' },
  { id: 'more', theme: 'dsh', shell: 'dsh', size: [1440, 900], click: '#saMore' },
  { id: 'palette', theme: 'dsh', shell: 'dsh', size: [1440, 900], key: 'Control+k' },
  { id: 'toc-collapsed', theme: 'dsh', shell: 'dsh', size: [1440, 900], click: '#tocBtn' },
];

const filter = process.argv.slice(2);

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DATA, f));
  }
  const cacheSrc = path.join(REAL, 'chapters');
  if (fs.existsSync(cacheSrc)) {
    fs.mkdirSync(path.join(DATA, 'chapters'), { recursive: true });
    for (const f of fs.readdirSync(cacheSrc)) if (f.endsWith('.json')) fs.copyFileSync(path.join(cacheSrc, f), path.join(DATA, 'chapters', f));
  }
  fs.writeFileSync(path.join(DATA, 'window.json'), JSON.stringify({ width: 1440, height: 900, x: 40, y: 40 }), 'utf8');

  const log = fs.openSync(path.join(OUT, 'app.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });

  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { console.error('❌ 連不上 ' + PORT); process.exit(2); }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await sleep(1600);

  await page.evaluate((b) => window.__moyuDebug.openBook(b), BOOK);
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 5)) break; await sleep(400); }
  await sleep(1200);

  const report = [];
  for (const s of SHOOTS) {
    if (filter.length && !filter.some((f) => s.id.includes(f) || String(s.size[0]).includes(f))) continue;
    await page.evaluate((cfg) => {
      const D = window.__moyuDebug;
      D.setShell(cfg.shell); D.setTheme(cfg.theme);
      document.querySelectorAll('.panel:not([hidden]), .marks-panel:not([hidden]), .stats-panel:not([hidden]), .hist-panel:not([hidden]), .phone-panel:not([hidden]), .overflow:not([hidden]), .theme-menu:not([hidden]), .ctx.on').forEach((el) => {
        if (el.classList.contains('ctx')) el.classList.remove('on'); else el.hidden = true;
      });
      const app = document.querySelector('.app');
      app.dataset.toc = '1'; app.dataset.rail = '0';
      document.body.classList.remove('bossing');
    }, s);
    await page.evaluate((sz) => window.moyu?.win?.setState?.({ width: sz[0], height: sz[1] }), s.size);
    await sleep(700);
    if (s.click) {
      await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.click(); }, s.click);
      await sleep(500);
    }
    if (s.key) {
      await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
      await sleep(500);
    }
    const file = path.join(OUT, `${s.id}.png`);
    await page.screenshot({ path: file });
    const geo = await page.evaluate(() => {
      const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const de = document.documentElement;
      return {
        iw: innerWidth, ih: innerHeight,
        overflowX: de.scrollWidth - de.clientWidth, overflowY: de.scrollHeight - de.clientHeight,
        side: r('.side'), topbar: r('.topbar'), right: r('.dsh-right'), status: r('.statusbar'),
        composer: r('.composer .box'), stream: r('#stream'), thread: r('.thread'),
        rail: document.querySelector('.app').classList.contains('side-rail'),
      };
    });
    report.push({ id: s.id, theme: s.theme, shell: s.shell, size: s.size, file: path.relative(ROOT, file), ...geo });
    console.log(`✅ ${s.id.padEnd(16)} ${s.size.join('×')} side=${geo.side && geo.side[2]} topbar=${geo.topbar && geo.topbar[3]} right=${geo.right && geo.right[2]} ovf=${geo.overflowX}/${geo.overflowY}`);
  }

  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ report, errors: errors.slice(0, 10) }, null, 2), 'utf8');
  console.log('\n' + OUT);
  if (errors.length) console.log('pageerror:', errors.slice(0, 5).join(' | '));
  browser.disconnect();
  try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 600);
})();
