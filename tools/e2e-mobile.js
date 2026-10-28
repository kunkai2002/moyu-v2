// 手機 PWA 驗證（用 headless Chrome 模擬手機，不開任何視窗）
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=390,844'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/m/#t=${encodeURIComponent(TOKEN)}`, { waitUntil: 'networkidle2' });
  await sleep(1200);

  const boot = await page.evaluate(() => ({
    tokenPrompt: !!document.querySelector('.token'),
    title: document.getElementById('title')?.textContent || '',
  }));
  !boot.tokenPrompt ? ok('手機頁：金鑰自動帶入，沒有跳配對') : bad('手機頁：還在要求貼金鑰');

  let cards = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    cards = await page.evaluate(() => document.querySelectorAll('.shelf .card').length);
    if (cards > 0) break;
  }
  cards > 5 ? ok(`手機頁：書架 ${cards} 本`) : bad('手機頁：書架沒出來');

  const first = await page.evaluate(() => document.querySelector('.shelf .card')?.innerText.replace(/\n/g, ' | '));
  first ? ok('手機頁：卡片文字', String(first).slice(0, 40)) : bad('手機頁：卡片是空的');

  await page.evaluate(() => document.querySelector('.shelf .card').click());
  await sleep(2600);
  // 有些書的進度停在付費章節（只有試讀），先跳到第 1 章再驗閱讀與接章
  await page.evaluate(async () => {
    document.getElementById('btnToc').click();
    await new Promise((r) => setTimeout(r, 400));
    const first = document.querySelector('.toc-r');
    if (first) first.click();
  });
  let paras = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    paras = await page.evaluate(() => document.querySelectorAll('.read .p').length);
    if (paras > 5) break;
  }
  paras > 5 ? ok(`閱讀：正文 ${paras} 段`) : bad('閱讀：正文沒出來');

  const chars = await page.evaluate(() =>
    [...document.querySelectorAll('.read .p')].reduce((n, p) => n + p.innerText.length, 0));
  chars > 500 ? ok(`閱讀：${chars} 字`) : bad('閱讀：字數太少', String(chars));

  /* 滾到底 → 自動接下一章 */
  const before = await page.evaluate(() => document.querySelectorAll('.read .chap').length);
  for (let round = 0; round < 3; round++) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      window.dispatchEvent(new Event('scroll'));
    });
    await sleep(300);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('scroll'));
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(2600);
  }
  const after = await page.evaluate(() => document.querySelectorAll('.read .chap').length);
  after > before ? ok(`接章：${before} → ${after} 章`) : bad('接章：沒有自動接下一章', JSON.stringify({ before, after }));

  /* 目錄抽屜 */
  const toc = await page.evaluate(() => {
    document.getElementById('btnToc').click();
    const open = !document.getElementById('toc').hidden;
    const rows = document.querySelectorAll('.toc-r').length;
    document.getElementById('tocClose').click();
    return { open, rows };
  });
  toc.open && toc.rows > 10 ? ok(`目錄：抽屜 ${toc.rows} 章`) : bad('目錄：打不開', JSON.stringify(toc));

  /* 記住進度 */
  await page.evaluate(() => document.getElementById('remember').click());
  await sleep(700);
  const toastText = await page.evaluate(() => document.getElementById('toast').textContent);
  /記住/.test(toastText) ? ok(`記住進度：提示「${toastText}」`) : bad('記住進度：沒有提示', toastText);

  /* 劃線 */
  const marked = await page.evaluate(async () => {
    const p = document.querySelector('.read .p');
    p.click();
    await new Promise((r) => setTimeout(r, 800));
    return document.querySelectorAll('.read .p.marked').length;
  });
  marked > 0 ? ok('劃線：生效') : bad('劃線：沒生效');

  /* 雲端是否真的收到手機的進度 */
  const prog = await (await fetch(BASE + '/api/progress', {
    headers: { Authorization: 'Bearer ' + TOKEN },
  })).json();
  const phoneRows = (prog.progress || []).filter((r) => r.device === 'phone');
  phoneRows.length ? ok(`雲端：手機寫入 ${phoneRows.length} 筆進度`) : bad('雲端：沒收到手機進度');

  const marks = await (await fetch(`${BASE}/api/marks?book=7373660003258862617`, {
    headers: { Authorization: 'Bearer ' + TOKEN },
  })).json();
  (marks.marks || []).length ? ok(`雲端：標記 ${marks.marks.length} 筆`) : bad('雲端：沒收到標記');

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'mobile-e2e.png'), fullPage: false });

  console.log('\n===== 手機 PWA =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
