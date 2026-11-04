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

const APP = process.argv[2] || process.env.MOYU_APP_DIR || path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏');
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
    || cutBodies.every((b) => /[。！？…\.!?」』）)】》〕”’"']$/.test(b.tail));
  cutOk
    ? ok(`每個切點都在句尾（檢查 ${cutBodies.length} 個切點）`)
    : bad('有切點斷在句子中間', cutBodies.filter((b) => !/[。！？…\.!?」』）)】》〕”’"']$/.test(b.tail)).map((b) => b.tail).join(' | '));
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

  /* 「分析中… → 已完成」處理列 */
  const steps = await page.evaluate(() => {
    const list = [...document.querySelectorAll('#stream .step')].map((s) => ({
      text: (s.querySelector('.st-t')?.textContent || '').trim(),
      hasIcon: !!s.querySelector('.st-ico'),
    }));
    return list;
  });
  const POOL = ['思考中…', '已完成思考', '分析中…', '已完成分析', '整理段落中…', '段落已整理', '比對上下文中…', '比對完成'];
  steps.length >= 1
    ? ok(`處理列：${steps.length} 列（${steps.slice(0, 3).map((s) => s.text).join('、')}）`)
    : bad('處理列：一列都沒有');
  const badStep = steps.find((s) => !POOL.includes(s.text) || !s.hasIcon);
  badStep ? bad('處理列：用了預置詞以外的字', JSON.stringify(badStep)) : ok('處理列：字都在預置詞裡、都有圖示');

  /* 「點段落選取」已經拿掉：點正文不該長出劃線 */
  const clickTest = await page.evaluate(async () => {
    const p = document.querySelector('#stream .pb .p');
    if (!p) return { err: '沒有段落' };
    const before = document.querySelectorAll('#stream .p.marked').length;
    p.click();
    await new Promise((r) => setTimeout(r, 400));
    const after = document.querySelectorAll('#stream .p.marked').length;
    return { before, after, noteOpen: !!document.querySelector('#mkNoteBox') && !document.querySelector('#mkNoteBox').hidden };
  });
  clickTest.err ? bad('點段落：找不到段落', clickTest.err)
    : (clickTest.after === clickTest.before && !clickTest.noteOpen
      ? ok('點段落：不再選取／劃線')
      : bad('點段落：還會選取', JSON.stringify(clickTest)));

  /* 隱身模式：餵一個顏色，看色階有沒有跟著換、字看不看得清楚 */
  const ghost = await page.evaluate(() => {
    const G = window.__moyuGhost;
    if (!G) return { err: '沒有 __moyuGhost' };
    const css = (k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    G.set(false);                                  // 先確保關著，才量得到主題原本的底色
    const before = css('--bg');
    G.applySolid('#2b3a4a');
    const dark = { attr: document.documentElement.getAttribute('data-ghost'), bg: css('--bg'), fg: css('--fg') };
    G.applySolid('#f0ece4');
    const light = { bg: css('--bg'), fg: css('--fg') };
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const applied = G.applyImage(png, '#7a6a5a');
    const layerEl = document.querySelector('.ghost-bg');
    const image = {
      applied: !!applied,
      layer: !!layerEl && !layerEl.hidden,
      hasUrl: !!layerEl && /url\("data:image\/png/.test(layerEl.style.backgroundImage),
      bg: css('--bg'),
    };
    G.set(false);
    const after = css('--bg');
    const restored = document.documentElement.getAttribute('data-ghost');
    return { before, dark, light, image, after, restored };
  });
  const lum = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  };
  if (ghost.err) bad('隱身：模組沒載入', ghost.err);
  else {
    ghost.dark.attr === '1' && ghost.dark.bg === '#2b3a4a'
      ? ok('隱身：純色直接沿用（' + ghost.dark.bg + '）')
      : bad('隱身：底色沒照抓到的顏色', JSON.stringify(ghost.dark));
    const dl = lum(ghost.dark.fg), ll = lum(ghost.light.fg);
    const darkOk = dl !== null && dl > 0.5;
    const lightOk = ll !== null && ll < 0.45;
    darkOk && lightOk
      ? ok('隱身：字色自動反差（深底字 ' + ghost.dark.fg + '／亮底字 ' + ghost.light.fg + '）')
      : bad('隱身：字色反差不足', JSON.stringify({ dark: ghost.dark, light: ghost.light }));
    ghost.image.applied && ghost.image.layer && ghost.image.hasUrl && /rgba\(/.test(ghost.image.bg)
      ? ok('隱身：非純色走圖片模式（圖層貼上、面板半透明 ' + ghost.image.bg + '）')
      : bad('隱身：圖片模式沒生效', JSON.stringify(ghost.image));
    ghost.after === ghost.before && ghost.restored === null
      ? ok('隱身：關掉後回到原本主題')
      : bad('隱身：關掉後沒還原', JSON.stringify({ before: ghost.before, after: ghost.after, attr: ghost.restored }));
  }


  /* ── 開章位置：主動開一章要停在章首，不是最底 ── */
  const openPos = await page.evaluate(async () => {
    await window.__moyuDebug.goChapter(1, { announce: true });
    await new Promise((r) => setTimeout(r, 1200));
    const stream = document.querySelector('#stream');
    const body = document.querySelector('.pb[data-ci="1"]');
    if (!stream || !body) return { err: '沒有第 2 章' };
    const top = body.getBoundingClientRect().top - stream.getBoundingClientRect().top;
    return { top: Math.round(top), scrollTop: Math.round(stream.scrollTop),
             gapToBottom: Math.round(stream.scrollHeight - stream.scrollTop - stream.clientHeight) };
  });
  openPos.err ? bad('開章位置：找不到章節', openPos.err)
    : (openPos.top > -40 && openPos.top < 120 && openPos.gapToBottom > 40
      ? ok(`開章位置：停在章首（距頂 ${openPos.top}px，離底 ${openPos.gapToBottom}px）`)
      : bad('開章位置：還是跳到底', JSON.stringify(openPos)));

  /* ── CC 外殼：終端風的結構（> / ● / 假 diff），不是聊天氣泡 ── */
  const cc = await page.evaluate(async () => {
    window.__moyuDebug.setShell('cc');
    const D = window.__moyuDebug;
    await D.goChapter(0, { announce: true });
    await new Promise((r) => setTimeout(r, 1400));
    const user = document.querySelector('#stream .turn.user .bubble');
    const gut = document.querySelector('#stream .turn.ai .gutter');
    const body = document.querySelector('#stream .pb') || document.querySelector('#stream .b');
    const cs = (el, k) => (el ? getComputedStyle(el).getPropertyValue(k).trim() : '');
    return {
      shell: document.documentElement.getAttribute('data-shell'),
      bubbleBg: cs(user, 'background-color'),
      bubbleRadius: cs(user, 'border-top-left-radius'),
      mono: /mono|consolas|cascadia|menlo/i.test(cs(body, 'font-family')) || /mono/i.test(cs(user, 'font-family')),
      gutterText: (gut && getComputedStyle(gut, '::before').content) || '',
      diffs: document.querySelectorAll('#stream .cc-diff').length,
      before: (user && getComputedStyle(user, '::before').content) || '',
    };
  });
  cc.shell === 'cc' && (cc.bubbleBg === 'rgba(0, 0, 0, 0)' || cc.bubbleBg === 'transparent') && cc.bubbleRadius === '0px'
    ? ok('CC 外殼：使用者行是 > 而不是氣泡（無底色、無圓角）')
    : bad('CC 外殼：還是氣泡', JSON.stringify(cc));
  /●/.test(cc.gutterText) ? ok('CC 外殼：助手用 ● 角色行') : bad('CC 外殼：助手角色行不對', cc.gutterText);
  cc.mono ? ok('CC 外殼：正文用等寬字') : bad('CC 外殼：正文不是等寬');
  cc.diffs >= 1 ? ok(`CC 外殼：段落間有 ${cc.diffs} 塊假 diff`) : bad('CC 外殼：沒有假 diff');
  await page.evaluate(() => window.__moyuDebug.setShell('dsh'));

  /* ── 命令面板（⌘K）：開得起來、搜得到、執行得到 ── */
  const cmdk = await page.evaluate(async () => {
    const C = window.__moyuCmdk;
    if (!C) return { err: '沒有 __moyuCmdk' };
    C.open();
    await new Promise((r) => setTimeout(r, 120));
    const opened = C.isOpen();
    const count = C.items.length;
    const first = C.items.slice(0, 6);
    const inp = document.querySelector('#cmdkInput');
    inp.value = '隱身';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const filtered = C.items.slice();
    C.close();
    await new Promise((r) => setTimeout(r, 80));
    return { opened, count, first, filtered, closed: !C.isOpen() };
  });
  if (cmdk.err) bad('命令面板：沒載入', cmdk.err);
  else {
    cmdk.opened && cmdk.count >= 10 ? ok(`命令面板：${cmdk.count} 條命令（${cmdk.first.slice(0, 4).join('、')}…）`) : bad('命令面板：開不起來或命令太少', JSON.stringify(cmdk));
    cmdk.filtered.length === 1 && /隱身/.test(cmdk.filtered[0]) ? ok('命令面板：搜尋會收斂') : bad('命令面板：搜尋沒收斂', JSON.stringify(cmdk.filtered));
    cmdk.closed ? ok('命令面板：Esc／關閉正常') : bad('命令面板：關不掉');
  }

  /* ── 設定面板：五分頁、版本號不留空括號 ── */
  const setPanel = await page.evaluate(async () => {
    document.querySelector('#panel') && (document.querySelector('#panel').hidden = true);
    const btn = document.querySelector('#tbSettings') || [...document.querySelectorAll('.tb-btn,.ov-row')].find((b) => /設定/.test(b.textContent || ''));
    btn && btn.click();
    await new Promise((r) => setTimeout(r, 800));
    const panel = document.querySelector('#panel');
    const tabs = [...document.querySelectorAll('#panel .st-tab')].map((b) => b.textContent);
    const active = document.querySelector('#panel .st-page:not([hidden])');
    const rows = active ? [...active.querySelectorAll('.row')].map((r) => ((r.querySelector(':scope > span') || {}).textContent || '').trim()) : [];
    const upd = (document.querySelector('#updText')?.textContent || '').trim();
    return { open: !!panel && !panel.hidden, tabs, rows, upd };
  });
  setPanel.open && setPanel.tabs.length === 5
    ? ok(`設定：五分頁（${setPanel.tabs.join('／')}）`)
    : bad('設定：分頁沒建起來', JSON.stringify(setPanel.tabs));
  setPanel.rows.length >= 3 && setPanel.rows.length <= 6
    ? ok(`設定：外觀頁 ${setPanel.rows.length} 列（${setPanel.rows.join('、')}）`)
    : bad('設定：每頁列數超出規格（3–6）', JSON.stringify(setPanel.rows));
  setPanel.upd && !/（\s*）|\(\s*\)/.test(setPanel.upd)
    ? ok(`設定：版本號沒有空括號（「${setPanel.upd}」）`)
    : bad('設定：版本號空括號', setPanel.upd);
  await page.screenshot({ path: path.join(OUT, 'settings-panel.png') });
  await page.evaluate(() => { const p = document.querySelector('#panel'); if (p) p.hidden = true; });

  /* ── DSH 主題的元素形狀（不是只換色）── */
  const dshLook = await page.evaluate(async () => {
    window.__moyuDebug.setTheme('dsh');
    await new Promise((r) => setTimeout(r, 300));
    const thread = document.querySelector('#stream .thread');
    const bubble = document.querySelector('#stream .turn.user .bubble');
    const gut = document.querySelector('#stream .turn.ai .gutter');
    const box = document.querySelector('.box');
    const side = document.querySelector('.side');
    const g = (el, k) => (el ? getComputedStyle(el).getPropertyValue(k).trim() : '');
    return {
      threadW: thread ? Math.round(thread.getBoundingClientRect().width) : 0,
      bubbleRadius: g(bubble, 'border-top-left-radius'),
      bubbleBg: g(bubble, 'background-color'),
      bubblePad: g(bubble, 'padding-top') + '/' + g(bubble, 'padding-left'),
      gutterHidden: !gut || g(gut, 'display') === 'none',
      boxRadius: g(box, 'border-top-left-radius'),
      sideW: side ? Math.round(side.getBoundingClientRect().width) : 0,
      pAlign: g(document.querySelector('#stream .p'), 'text-align'),
    };
  });
  const dshOk = dshLook.threadW >= 700 && dshLook.threadW <= 780
    && dshLook.bubbleRadius === '20px'
    && dshLook.bubbleBg === 'rgb(44, 44, 46)'
    && dshLook.bubblePad === '10px/16px'
    && dshLook.gutterHidden
    && dshLook.boxRadius === '16px'
    && (dshLook.pAlign === 'start' || dshLook.pAlign === 'left');
  dshOk
    ? ok(`DSH 元素形狀：內容欄 ${dshLook.threadW}px、氣泡 20px/${dshLook.bubbleBg}、助手無頭像、輸入框 16px`)
    : bad('DSH 元素形狀不對（只換了顏色）', JSON.stringify(dshLook));

  /* ── 主題矩陣：七套主題每一套都要真的有自己的顏色（不是寫在清單裡卻沒樣式） ── */
  const themeMatrix = await page.evaluate(async () => {
    const D = window.__moyuDebug;
    const themes = [
      ['claude-code', '#1a1915'], ['claude', '#faf9f5'], ['vscode', '#1e1e1e'],
      ['excel', '#ffffff'], ['terminal', '#04070a'], ['word', '#f4f4f4'], ['dsh', '#151517'],
      ['dsh-light', '#ffffff'],
    ];
    const out = [];
    for (const [id, want] of themes) {
      D.setTheme(id);
      await new Promise((r) => setTimeout(r, 220));
      const got = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase();
      out.push({
        id, want, got,
        attr: document.documentElement.getAttribute('data-theme'),
        ok: got === want,
      });
    }
    return out;
  });
  const themeBad = themeMatrix.filter((t) => !t.ok || t.attr !== t.id);
  themeBad.length === 0
    ? ok('主題：8 套都有實際樣式（顏色與清單一致）')
    : bad('主題：有清單寫了但沒樣式的', JSON.stringify(themeBad));

  /* ── 可點擊不代表都是功能：畫面上任何 cursor:pointer 都必須是真的控制項 ── */
  const fakeClicks = await page.evaluate(() => {
    const OK_TAG = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'LABEL', 'SUMMARY']);
    const OK_CLS = ['ch', 'tm-item', 'ov-row', 'ctx-row', 'shelf-card', 'home-row', 'home-card',
      'hist-row', 'mk-row', 'grep-row', 'flow-more', 'proj', 'me', 'dt-btn', 'help-row', 'ov-sep'];
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (cs.cursor !== 'pointer') continue;
      if (OK_TAG.has(el.tagName)) continue;
      if (el.getAttribute('role') === 'button') continue;
      // 控制項裡面的 svg/path/rect 會繼承 pointer，那不算假按鈕
      const host = el.parentElement && el.parentElement.closest('button, a, label, [role=button], .ch, .tm-item, .ov-row, .ctx-row, .shelf-card, .home-row, .hist-row, .mk-row, .grep-row, .flow-more, .proj');
      if (host) continue;
      if (OK_CLS.some((c) => el.classList.contains(c))) continue;
      out.push(el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + '「' + (el.textContent || '').trim().slice(0, 12) + '」');
    }
    return out;
  });
  fakeClicks.length === 0
    ? ok('可點性：沒有「看起來能點卻不是功能」的東西')
    : bad('可點性：有假按鈕', fakeClicks.slice(0, 6).join(' | '));

  /* ── 新主題（DSH）：截圖三種尺寸，版面不可以撐破或被蓋 ── */
  await page.evaluate(() => window.__moyuDebug.setTheme('dsh'));
  await sleep(400);
  for (const { w, h } of [{ w: 1440, h: 900 }, { w: 1920, h: 1080 }, { w: 820, h: 620 }]) {
    await page.evaluate((st) => window.moyu?.win?.setState?.(st), { width: w, height: h });
    await sleep(650);
    const probe = await page.evaluate(() => {
      const de = document.documentElement;
      const cov = [];
      for (const b of document.querySelectorAll('.tb-btn, .hint-btn, .cn-btn')) {
        const r = b.getBoundingClientRect();
        if (r.width < 4) continue;
        const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        if (hit && hit !== b && !b.contains(hit)) cov.push(b.id || b.className);
      }
      return { ox: de.scrollWidth - de.clientWidth, cov, theme: de.getAttribute('data-theme') };
    });
    await page.screenshot({ path: path.join(OUT, `dsh-${w}x${h}.png`) });
    probe.theme === 'dsh' && probe.ox <= 0 && probe.cov.length === 0
      ? ok(`DSH 主題 ${w}×${h}：版面正常、按鈕沒被蓋`)
      : bad(`DSH 主題 ${w}×${h}：有問題`, JSON.stringify(probe));
  }

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
