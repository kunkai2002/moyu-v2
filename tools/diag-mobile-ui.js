// 手機版實況：用 iPhone 尺寸開無頭瀏覽器，截圖 + 量測
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();
const OUT = path.join(__dirname, '..', '_probe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  const errors = [];
  const consoleMsgs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleMsgs.push(m.text().slice(0, 160)); });

  await page.goto(`${BASE}/m/#t=${encodeURIComponent(TOKEN)}`, { waitUntil: 'networkidle2' });
  await sleep(2000);

  /* ── 1. 書架 ── */
  const shelf = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: Math.round(b.width), h: Math.round(b.height),
        x: Math.round(b.x), y: Math.round(b.y),
        fs: cs.fontSize, lh: cs.lineHeight, color: cs.color, bg: cs.backgroundColor,
        display: cs.display, overflow: cs.overflow,
      };
    };
    return {
      viewport: [innerWidth, innerHeight],
      docScroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      bodyScrollW: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      top: r('.top'),
      title: r('.ttl'),
      grid: r('.shelf'),
      card: r('.card'),
      cardText: document.querySelector('.card')?.innerText.replace(/\n/g, ' | '),
      count: document.querySelectorAll('.card').length,
      empty: r('.empty'),
      pill: r('#remember') ? (document.getElementById('remember').hidden ? 'hidden' : 'visible') : 'none',
    };
  });
  await page.screenshot({ path: path.join(OUT, 'mobile-1-shelf.png') });

  /* ── 2. 開一本書，先跳第 1 章 ── */
  await page.evaluate(() => {
    const card = document.querySelector('.shelf .card');
    if (card) card.click();
  });
  await sleep(3000);
  await page.evaluate(() => {
    const btn = document.getElementById('btnToc');
    if (btn && !btn.hidden) btn.click();
  });
  await sleep(500);
  const tocShot = await page.screenshot({ path: path.join(OUT, 'mobile-2-toc.png') });
  await page.evaluate(() => {
    const first = document.querySelector('.toc-r');
    if (first) first.click();
  });
  await sleep(3200);

  const reader = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.y),
        fs: cs.fontSize, lh: cs.lineHeight, pad: cs.padding, mar: cs.margin,
        color: cs.color, bg: cs.backgroundColor,
      };
    };
    const ps = [...document.querySelectorAll('.read .p')];
    return {
      top: r('.top'),
      read: r('.read'),
      chap: r('.read .chap'),
      p: r('.read .p'),
      pCount: ps.length,
      firstText: (ps[0]?.innerText || '').slice(0, 40),
      textWidth: ps[0] ? Math.round(ps[0].getBoundingClientRect().width) : 0,
      docW: document.documentElement.scrollWidth,
      innerW: innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      bodyH: document.body.scrollHeight,
      remember: (() => {
        const el = document.getElementById('remember');
        if (!el) return 'none';
        const b = el.getBoundingClientRect();
        return { hidden: el.hidden, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      })(),
      tocHidden: document.getElementById('toc').hidden,
      fontVar: getComputedStyle(document.documentElement).getPropertyValue('--fs').trim(),
    };
  });
  await page.screenshot({ path: path.join(OUT, 'mobile-3-reader.png') });

  /* ── 3. 往下滑，看接章與 sticky ── */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(400);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('touchmove', { bubbles: true }));
    window.dispatchEvent(new Event('scroll'));
  });
  await sleep(3000);
  const afterScroll = await page.evaluate(() => ({
    chaps: document.querySelectorAll('.read .chap').length,
    paras: document.querySelectorAll('.read .p').length,
    scrollY: Math.round(window.scrollY),
    bodyH: document.body.scrollHeight,
    topY: Math.round(document.querySelector('.top').getBoundingClientRect().y),
  }));
  await page.screenshot({ path: path.join(OUT, 'mobile-4-shelvescroll.png') });

  /* ── 4. 點頂欄按鈕（換色 / 目錄） ── */
  const taps = await page.evaluate(() => {
    const out = {};
    const th = document.getElementById('btnTheme');
    const before = document.documentElement.getAttribute('data-theme');
    th.click();
    out.themeBefore = before;
    out.themeAfter = document.documentElement.getAttribute('data-theme');
    const tocBtn = document.getElementById('btnToc');
    tocBtn.click();
    out.tocOpened = !document.getElementById('toc').hidden;
    document.getElementById('tocClose').click();
    out.backVisible = !document.getElementById('btnBack').hidden;
    return out;
  });

  /* ── 5. 小屏（320×568，iPhone SE）── */
  await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(600);
  const small = await page.evaluate(() => ({
    innerW: innerWidth,
    docW: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth - innerWidth,
    pWidth: document.querySelector('.read .p') ? Math.round(document.querySelector('.read .p').getBoundingClientRect().width) : 0,
    fs: document.querySelector('.read .p') ? getComputedStyle(document.querySelector('.read .p')).fontSize : '',
    topH: Math.round(document.querySelector('.top').getBoundingClientRect().height),
    pill: (() => { const p = document.getElementById('remember'); const b = p.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; })(),
  }));
  await page.screenshot({ path: path.join(OUT, 'mobile-5-small.png') });

  console.log(JSON.stringify({ shelf, reader, afterScroll, taps, small, errors, consoleMsgs }, null, 1));
  await browser.close();
})();
