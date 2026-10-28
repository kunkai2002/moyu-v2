// 真帳號書架驗證：複製現有登入態到 probe，跑 /shelf 看書有沒有出來、能不能開
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const REAL = path.join(APP, 'data');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-shelf');
const PORT = 9338;

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(EXE)) { console.error('找不到 electron.exe'); process.exit(2); }
  if (!fs.existsSync(path.join(REAL, 'cookie.txt'))) {
    console.error('❌ 安裝目錄沒有 cookie.txt，代表還沒登入'); process.exit(2);
  }

  // 複製登入態（cookie + 進度），不含快取
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'progress.json', 'settings.json', 'prefs.json', 'shelf.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });

  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'shelf.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'], {
    stdio: ['ignore', log, log],
  });

  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { console.error('❌ 連不上偵錯埠'); process.exit(2); }

  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    page = pages.find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  if (!page) { console.error('❌ 找不到 app 頁面'); browser.disconnect(); process.exit(2); }

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await sleep(1400);

  const typeCmd = (t) => page.evaluate((x) => {
    const i = document.querySelector('#input');
    i.value = x;
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, t);

  /* 登入態 */
  const login = await page.evaluate(async () => await window.moyu.cookie.get());
  login.loggedIn ? ok(`登入態：已登入（${login.preview}）`) : bad('登入態：未登入');

  /* /shelf */
  await typeCmd('/shelf');
  let cards = 0, errText = '';
  for (let i = 0; i < 24; i++) {
    await sleep(500);
    const r = await page.evaluate(() => {
      const list = document.querySelectorAll('.shelf-card');
      const toolres = [...document.querySelectorAll('.toolres')].pop();
      return { n: list.length, t: toolres ? toolres.innerText.trim().slice(0, 60) : '' };
    });
    cards = r.n;
    if (cards > 0) break;
    if (r.t && !r.t.includes('讀取')) { errText = r.t; break; }
  }
  cards > 0 ? ok(`書架：出現 ${cards} 本書`) : bad('書架：一本都沒出來', errText || '無錯誤訊息');

  const first = await page.evaluate(() => {
    const c = document.querySelector('.shelf-card');
    return c ? c.innerText.replace(/\n+/g, ' | ').trim().slice(0, 60) : '';
  });
  if (first) ok('書架：卡片有書名/進度', first);

  /* 點第一本 → 能不能開 */
  if (cards > 0) {
    await page.evaluate(() => document.querySelector('.shelf-card').click());
    let chapters = 0;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      chapters = await page.evaluate(() => document.querySelectorAll('#tree .ch').length);
      if (chapters > 0) break;
    }
    chapters > 0 ? ok(`開書：目錄載入 ${chapters} 章`) : bad('開書：目錄沒出來');
  }

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  /* 逐本開、逐章讀：免費章節要出全文，付費章節要出試讀說明（不能空白） */
  async function readFirstChapter(bookId, label) {
    await page.evaluate(async (id) => { await window.__moyuDebug.openBook(id); }, bookId);
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const n = await page.evaluate(() => document.querySelectorAll('#tree .ch').length);
      if (n > 10) break;
    }
    await page.evaluate(() => window.__moyuDebug.goChapter(0, { announce: false }));
    let out = { chars: 0, preview: false, err: '' };
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      out = await page.evaluate(() => {
        const ps = [...document.querySelectorAll('.pb .p')];
        const txt = document.body.innerText;
        return {
          chars: ps.reduce((n, p) => n + p.innerText.trim().length, 0),
          preview: txt.includes('試讀'),
          err: txt.includes('需要付費') || txt.includes('抓不到正文') ? '有錯誤訊息' : '',
        };
      });
      if (out.chars > 0) break;
    }
    return out;
  }

  const freeBook = await readFirstChapter('7373660003258862617', '免費書');
  freeBook.chars > 500 ? ok(`免費書：第1章 ${freeBook.chars} 字`) : bad('免費書：第1章讀不到', JSON.stringify(freeBook));

  const paidBook = await readFirstChapter('7357889084515175449', '付費書');
  (paidBook.chars > 0 || paidBook.preview) ? ok(`付費書：第1章 ${paidBook.chars} 字${paidBook.preview ? '（試讀提示）' : ''}`)
    : bad('付費書：第1章空白', JSON.stringify(paidBook));

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'shelf-e2e.png') });

  console.log('\n===== 書架（真帳號）E2E =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(600);
  process.exit(fails === 0 ? 0 : 1);
})();
