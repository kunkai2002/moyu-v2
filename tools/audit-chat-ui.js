// 對話界面驗收：真實資料、多尺寸截圖 + 規則檢查（對照《門戶交付檢查標準》）
//
//   node tools/audit-chat-ui.js
//
// 檢查：主視窗不能有捲軸、按鈕不能被蓋住、chrome 不准出現小說用語、
//       章節是使用者的氣泡、助手回覆切成 1–3 段、切點落在句尾。
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const REAL = path.join(APP, 'data');
const PROBE = path.join(__dirname, '..', '_probe', 'audit-data');
const OUT = path.join(__dirname, '..', '_probe', 'audit');
const PORT = 9351;
const BOOK = '7143038691944959011';

const SIZES = [
  { w: 1280, h: 720 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
  { w: 820, h: 620 },    // 窄：目錄變抽屜、卡片不撐破
];

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json', 'progress.json', 'shelf.json', 'sync.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });
  // 章節快取照抄，測真資料（不重抓）
  const cacheSrc = path.join(REAL, 'chapters');
  if (fs.existsSync(cacheSrc)) {
    for (const f of fs.readdirSync(cacheSrc)) {
      if (f.endsWith('.json')) fs.copyFileSync(path.join(cacheSrc, f), path.join(PROBE, 'chapters', f));
    }
  }
  fs.writeFileSync(path.join(PROBE, 'window.json'),
    JSON.stringify({ width: 1440, height: 900, x: 80, y: 60, maximized: false }), 'utf8');

  const log = fs.openSync(path.join(OUT, 'app.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv()});

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
  if (!page) { console.error('❌ 找不到頁面'); browser.disconnect(); process.exit(2); }

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await sleep(1600);

  /* 開到真實進度那一章 */
  await page.evaluate((b) => window.__moyuDebug.openBook(b), BOOK);
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 5)) break;
  }
  await sleep(1200);

  const shot = async (w, h, mine) => {
    await page.evaluate((s) => window.moyu?.win?.setState?.(s), { width: w, height: h });
    await sleep(700);
    const file = path.join(OUT, `chat-${w}x${h}${mine ? '-marks' : ''}.png`);
    await page.screenshot({ path: file });
    return file;
  };

  /* ── 版面規則（每種尺寸都跑） ── */
  for (const { w, h } of SIZES) {
    const f = await shot(w, h);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const main = document.querySelector('.main');
      const app = document.querySelector('.app');
      const covered = [];
      for (const b of document.querySelectorAll('.tb-btn, .hint-btn, .cn-btn, .ghost.icon')) {
        const r = b.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        if (!hit) continue;
        if (hit !== b && !b.contains(hit)) covered.push((b.id || b.className) + '→' + (hit.id || hit.className));
      }
      const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      const chromeText = [
        document.querySelector('.topbar')?.innerText || '',
        document.querySelector('.composer')?.innerText || '',
        document.querySelector('.statusbar')?.innerText || '',
        document.querySelector('.side-foot')?.innerText || '',
      ].join(' ');
      return {
        winW: innerWidth, winH: innerHeight,
        docOverflowX: de.scrollWidth - de.clientWidth,
        docOverflowY: de.scrollHeight - de.clientHeight,
        appOverflowX: app ? app.scrollWidth - app.clientWidth : 0,
        mainOverflowX: main ? main.scrollWidth - main.clientWidth : 0,
        covered,
        hasEmoji: emoji.test(chromeText),
        chromeText,
      };
    });
    m.docOverflowX <= 0 && m.mainOverflowX <= 0
      ? ok(`${w}×${h}：主視窗沒有橫向捲軸`)
      : bad(`${w}×${h}：出現橫向捲軸`, `doc+${m.docOverflowX} main+${m.mainOverflowX}`);
    m.covered.length === 0
      ? ok(`${w}×${h}：按鈕沒有被蓋住`)
      : bad(`${w}×${h}：按鈕被蓋住`, m.covered.slice(0, 4).join(' | '));
    m.hasEmoji ? bad(`${w}×${h}：chrome 有 emoji/符號圖示`, m.chromeText.slice(0, 80)) : ok(`${w}×${h}：chrome 沒有 emoji 圖示`);
    const banned = ['下一章', '上一章', '指令表', 'auto-read', '章節 '];
    const hitWords = banned.filter((k) => m.chromeText.includes(k));
    hitWords.length === 0
      ? ok(`${w}×${h}：chrome 沒有小說用語`)
      : bad(`${w}×${h}：chrome 還有小說用語`, hitWords.join(','));
  }

  /* ── 對話結構（用 1440×900 看） ── */
  await shot(1440, 900);
  await page.evaluate(() => { const s0 = document.querySelector('#stream'); if (s0) s0.scrollTop = 0; });
  await sleep(450);
  await page.screenshot({ path: path.join(OUT, 'chat-chapter-top.png') });
  await page.evaluate(() => {
    const u = [...document.querySelectorAll('#stream .turn.user')].pop();
    if (u) u.scrollIntoView({ block: 'start' });
  });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'chat-conversation.png') });
  await page.evaluate(() => {
    const s = document.querySelector('#stream');
    if (s) s.scrollTop = s.scrollHeight;
  });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'chat-bottom.png') });
  const chat = await page.evaluate(() => {
    const turns = [...document.querySelectorAll('#stream .turn')];
    const users = turns.filter((t) => t.classList.contains('user'));
    const ais = turns.filter((t) => t.classList.contains('ai'));
    const bubbles = users.map((t) => (t.querySelector('.bubble')?.textContent || '').trim());
    const bodies = [...document.querySelectorAll('#stream .pb')].map((b) => ({
      ci: b.dataset.ci, part: b.dataset.part, ps: b.querySelectorAll('.p').length,
      chars: [...b.querySelectorAll('.p')].reduce((n, p) => n + p.innerText.trim().length, 0),
      last: b.dataset.done === '1',
      tail: (b.querySelector('.p:last-of-type')?.innerText || '').trim().slice(-1),
    }));
    const partsPerChapter = {};
    for (const b of bodies) partsPerChapter[b.ci] = (partsPerChapter[b.ci] || 0) + 1;
    const chapterWord = document.querySelectorAll('#stream .chap').length;
    const nextRow = document.querySelectorAll('#stream .next').length;
    const sentinelText = (document.querySelector('#stream .flow-more')?.innerText || '').trim();
    return { users: users.length, ais: ais.length, bubbles, bodies, partsPerChapter, chapterWord, nextRow, sentinelText };
  });
  chat.users >= 1 ? ok(`對話：${chat.users} 則使用者氣泡 / ${chat.ais} 則助手回覆`) : bad('對話：沒有使用者氣泡');
  const longest = chat.bubbles.reduce((m, b) => Math.max(m, b.length), 0);
  longest <= 40 ? ok(`使用者氣泡很短（最長 ${longest} 字）`) : bad('使用者氣泡太長', String(longest));
  const parts = Object.values(chat.partsPerChapter);
  const inRange = parts.every((n) => n >= 1 && n <= 3);
  inRange ? ok(`一章切成 ${[...new Set(parts)].join('/')} 段（最多 3 段＝截斷兩次）`) : bad('切段數不對', JSON.stringify(chat.partsPerChapter));
  /* 切點必須落在句尾：每一章除了最後一段，其餘各段結尾都要是句末標點 */
  const byCi = {};
  for (const b of chat.bodies) (byCi[b.ci] = byCi[b.ci] || []).push(b);
  const cutBodies = [];
  for (const k of Object.keys(byCi)) {
    const list = byCi[k];
    list.slice(0, -1).forEach((b) => cutBodies.push(b));
  }
  const cutOk = cutBodies.length === 0
    || cutBodies.every((b) => /[。！？…\.!?」』）)】"']$/.test(b.tail));
  cutOk
    ? ok(`每個切點都在句尾（檢查 ${cutBodies.length} 個切點）`)
    : bad('有切點斷在句子中間', cutBodies.filter((b) => !/[。！？…\.!?」』）)】"']$/.test(b.tail)).map((b) => b.tail).join(' | '));
  const paraSum = chat.bodies.reduce((n, b) => n + b.ps, 0);
  paraSum > 8 ? ok(`正文共 ${paraSum} 段（切段沒有吃掉段落）`) : bad('正文段落太少', String(paraSum));
  chat.chapterWord === 0 ? ok('舊的章節標題（.chap）已移除') : bad('.chap 還在', String(chat.chapterWord));
  chat.nextRow === 0 ? ok('舊的「繼續下一章」列已移除') : bad('.next 還在', String(chat.nextRow));
  !/下一章|繼續往下/.test(chat.sentinelText) ? ok('接續提示只剩圖示') : bad('接續提示還有字', chat.sentinelText);

  /* 使用者氣泡在右、助手在左 */
  const align = await page.evaluate(() => {
    const u = document.querySelector('#stream .turn.user');
    const a = document.querySelector('#stream .turn.ai');
    if (!u || !a) return null;
    const ur = u.querySelector('.bubble').getBoundingClientRect();
    const ar = a.querySelector('.b').getBoundingClientRect();
    return { uRight: innerWidth - ur.right, aLeft: ar.left, uW: ur.width, aW: ar.width };
  });
  align && align.uRight < align.aLeft + 40 && align.aW > align.uW
    ? ok(`氣泡靠右（離右緣 ${Math.round(align.uRight)}px）、正文比氣泡寬（${Math.round(align.aW)} > ${Math.round(align.uW)}）`)
    : bad('對話左右配置不對', JSON.stringify(align));

  /* 圖示：頭像與 App 圖示都要是 SVG，不是符號字 */
  const icon = await page.evaluate(() => {
    const g = document.querySelector('#stream .turn.ai .gutter');
    return { svg: !!g?.querySelector('svg'), text: (g?.textContent || '').trim() };
  });
  icon.svg && !icon.text ? ok('助手頭像用 SVG 品牌記號') : bad('助手頭像還是字元', JSON.stringify(icon));

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  console.log('\n===== 對話界面驗收 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);
  console.log('截圖：' + OUT);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(500);
  process.exit(fails === 0 ? 0 : 1);
})();
