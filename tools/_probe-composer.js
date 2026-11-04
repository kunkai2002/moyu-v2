// 一次性診斷：量 composer 上方那條空白是什麼
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const appEnv = require('./app-env');
const APP = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const PROBE = path.join(__dirname, '..', '_probe', 'composer-diag');
const PORT = 9371;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(PROBE, 'window.json'), JSON.stringify({ width: 1500, height: 700, x: 60, y: 60, maximized: false }), 'utf8');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'], { stdio: 'ignore', env: appEnv() });
  let browser = null;
  for (let i = 0; i < 40 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 30 && !page; i++) { const ps = await browser.pages().catch(() => []); page = ps.find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  await sleep(1800);
  // 設定 dsh 主題、開一章
  await page.evaluate(async () => { try { window.__moyuDebug.setTheme('dsh'); } catch {} });
  await sleep(300);
  const info = await page.evaluate(async () => {
    const D = window.__moyuDebug;
    try { await D.openChapter?.(0); } catch {}
    await new Promise((r) => setTimeout(r, 1200));
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
    const stream = document.querySelector('#stream');
    const thread = document.querySelector('#stream .thread');
    const composer = document.querySelector('.composer');
    const box = document.querySelector('.composer .box');
    const hint = document.querySelector('.composer .hintline');
    const kids = [...document.querySelectorAll('#stream > *')].map((el) => ({
      tag: el.tagName.toLowerCase(), cls: el.className, r: r(el),
      text: (el.textContent || '').trim().slice(0, 20),
    }));
    const turns = [...document.querySelectorAll('#stream .turn')].slice(-3).map((el) => ({ cls: el.className, r: r(el), text: (el.textContent || '').trim().slice(0, 24) }));
    // 空白帶：thread 底到 box 頂之間
    const gap = { threadBottom: r(thread)?.y + r(thread)?.h, boxTop: r(box)?.y, composerTop: r(composer)?.y };
    const midY = Math.round((r(box).y + r(thread).y + r(thread).h) / 2);
    const stack = document.elementsFromPoint(700, midY).slice(0, 6).map((el) => el.tagName.toLowerCase() + '.' + el.className);
    return { stream: r(stream), thread: r(thread), composer: r(composer), box: r(box), hint: r(hint), kids, turns, gap, midY, stack, scrollTop: stream.scrollTop, scrollH: stream.scrollHeight, clientH: stream.clientHeight };
  });
  console.log(JSON.stringify(info, null, 1));
  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(300);
  process.exit(0);
})();
