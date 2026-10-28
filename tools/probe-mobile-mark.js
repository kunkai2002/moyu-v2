// 手機劃線為什麼不生效：抓 API 狀態與 state.marks
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-first-run'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  p.on('response', async (r) => {
    if (r.url().includes('/api/marks')) console.log('MARKS', r.request().method(), r.status());
  });
  await p.goto('https://moyu-sync.qiaoyuhua2002.workers.dev/m/#t=' + encodeURIComponent(TOKEN), { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  const bookId = await p.evaluate(() => document.querySelector('.card')?.dataset.book);
  await p.evaluate((id) => document.querySelector('.card[data-book="' + id + '"]').click(), bookId);
  await new Promise((r) => setTimeout(r, 3200));

  const before = await p.evaluate(() => ({
    paras: document.querySelectorAll('.read .p').length,
    marked: document.querySelectorAll('.p.marked').length,
    ch: document.querySelector('.read .p')?.dataset.chapter,
    para: document.querySelector('.read .p')?.dataset.para,
  }));
  console.log('before:', JSON.stringify(before));

  const after = await p.evaluate(async () => {
    const el = document.querySelector('.read .p');
    el.click();
    await new Promise((r) => setTimeout(r, 1400));
    return {
      cls: el.className,
      marked: document.querySelectorAll('.p.marked').length,
      toast: document.getElementById('toast').textContent,
    };
  });
  console.log('after:', JSON.stringify(after));

  const marks = await (await fetch('https://moyu-sync.qiaoyuhua2002.workers.dev/api/marks?book=' + bookId, {
    headers: { Authorization: 'Bearer ' + TOKEN },
  })).json();
  console.log('雲端標記數:', (marks.marks || []).length, JSON.stringify((marks.marks || []).slice(0, 2)));
  await b.close();
})();
