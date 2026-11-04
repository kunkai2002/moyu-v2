// 樣式探針：把關鍵元素的 computed style 印出來（改完 CSS 後確認真的吃到）
//   node tools/probe-styles.js [寬x高]
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'probe-data');
const PORT = 9373;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] || '1440x900').split('x').map(Number);

const SELECTORS = {
  crumb: '.topbar .crumb',
  crumbB: '.topbar .crumb b',
  tab: '.head-tab',
  tbBtn: '.topbar .tb-btn',
  brandName: '.brand-name',
  saNew: '.sa-new',
  sa: '.side-actions .sa',
  srRow: '.sr-row',
  chNo: '.dsh-right .ch .no',
  chNm: '.dsh-right .ch .nm',
  find: '.dsh-right .find',
  box: '.composer .box',
  boxFoot: '.composer .box-foot',
  input: '#input',
  status: '.statusbar',
  sbChapter: '#sbChapter',
  step: '.step',
  meta: '.meta',
  ccDiff: '.cc-diff',
  ccDb: '.cc-db',
  rz: '.think',
  rzHead: '.think-h',
  rzLine: '.think-l',
};

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt']) {
    const s = path.join(REAL, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(DATA, f));
  }
  const cs = path.join(REAL, 'chapters');
  if (fs.existsSync(cs)) { fs.mkdirSync(path.join(DATA, 'chapters'), { recursive: true }); for (const f of fs.readdirSync(cs)) if (f.endsWith('.json')) fs.copyFileSync(path.join(cs, f), path.join(DATA, 'chapters', f)); }
  fs.writeFileSync(path.join(DATA, 'window.json'), JSON.stringify({ width: w, height: h, x: 40, y: 40 }), 'utf8');
  const log = fs.openSync(path.join(ROOT, '_probe', 'probe.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message)));
  await sleep(1500);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  await page.evaluate((b) => window.__moyuDebug.openBook(b), '7143038691944959011');
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 8)) break; await sleep(400); }
  await sleep(1200);
  const out = await page.evaluate((sels) => {
    const res = {};
    for (const [k, sel] of Object.entries(sels)) {
      const el = document.querySelector(sel);
      if (!el) { res[k] = 'MISSING'; continue; }
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      res[k] = {
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        font: `${c.fontSize}/${c.lineHeight} ${c.fontWeight}`,
        color: c.color, bg: c.backgroundColor, radius: c.borderTopLeftRadius,
        pad: c.padding, margin: c.margin, gap: c.gap, border: c.borderTopWidth,
        transition: c.transitionProperty === 'all' ? 'all ' + c.transitionDuration : c.transitionDuration,
      };
    }
    res._counts = {
      ccDiff: document.querySelectorAll('.cc-diff').length,
      step: document.querySelectorAll('.step').length,
      rzh: document.querySelectorAll('.rz').length,
      polishLoaded: !!Array.from(document.styleSheets).find((s) => (s.href || '').includes('dsh-polish.css')),
      polish2Loaded: !!Array.from(document.styleSheets).find((s) => (s.href || '').includes('dsh-polish-2.css')),
    };
    return res;
  }, SELECTORS);
  for (const [k, v] of Object.entries(out)) {
    if (k.startsWith('_')) continue;
    if (v === 'MISSING') { console.log(`❌ ${k.padEnd(12)} MISSING`); continue; }
    console.log(`${k.padEnd(12)} ${String(v.box).padEnd(22)} ${v.font.padEnd(18)} r=${v.radius.padEnd(8)} pad=${v.pad.padEnd(22)} gap=${v.gap}`);
  }
  console.log('\n', JSON.stringify(out._counts));
  if (errors.length) console.log('pageerror:', errors.slice(0, 3));
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 500);
})();
