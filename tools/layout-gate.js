/* 版面閘門（layout gate）· 2026-11-07 照真工具重做版
   ─────────────────────────────────────────────────────────────
   2026-11-07 JOJO 拍板：兩個殼照真工具重做、九成像——dsh＝DeepSeek Harness、cc＝Claude 桌面版 Code 分頁
   （ui/shell-base.css＋shell-dsh.css＋shell-cc.css）。這一支量「兩個殼的規則」：

     S  SPEC（下方常數）＝殼的契約。改殼的尺寸，要同時改這裡，否則紅燈。
     G0 另一個殼的元素看不見（.only-dsh／.only-cc）     G8  輸入卡在視窗底之上
     G1 不准橫向捲動                                   G9  對話流夾在頂部與輸入卡之間
     G2 頂部高度＝SPEC（cc 頂列單列不換行）              G10 窄視窗（側欄抽屜時）正文欄拿滿整個寬度
     G3 正文欄＝輸入卡同軸；dsh 卡片兩側外擴 16、卡裡的字對齊正文   G11 抽屜真的打得開、遮罩點一下真的關
     G4 側欄：≥斷點在版面裡（dsh 280／cc 240）、以下是抽屜 G12 頂部每顆看得到的按鈕都點得到（中心點命中自己）
     G5 右欄：≥斷點停靠（dsh 300／cc 320）、以下是抽屜     G13 兩個殼的外殼文字都沒有偽裝黑名單（繁／簡／英）
     G6 輸入卡下一行（dsh 統計／cc 模型＋權限）在畫面內   G7 只有圖示的頂部按鈕 16px

   斷點不在這裡另寫一份：從畫面的 window.__moyuLayoutBreakpoints 讀（shell-dsh.js 唯一來源）。
   --selftest：先在合成頁量已知尺寸（誤差必須 0），量測引擎可信才報真結果。

   用法：
     node tools/layout-gate.js             # 全部（兩個殼 × 六種尺寸 ＋ 抽屜 ＋ 偽裝）
     node tools/layout-gate.js --selftest  # 只驗量測引擎
     node tools/layout-gate.js --port=9357
     node tools/layout-gate.js --sabotage  # 證明閘門會紅：故意弄壞四處，期望 G3/G4/G12/G13 都紅、exit 1
   報告：_probe/layout-gate.json
   邊界：只讀 ui/；資料夾用 _probe/layout-data（從安裝版 data 複製，唯讀；不帶 sync.json＝不連雲端）。 */
'use strict';

const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const appEnv = require('./app-env');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'layout-data');
const REPORT = path.join(ROOT, '_probe', 'layout-gate.json');
const BOOK = '7143038691944959011';
const ARGV = process.argv.slice(2);
const opt = (n, d) => { const h = ARGV.find((a) => a.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 9357));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── S：殼的契約（2026-11-07 重做：照真工具九成像；與 ui/shell-dsh.css、shell-cc.css 同步）──
   dsh＝DeepSeek Harness：側欄 280、右欄 300、頂部 76（標題列＋分頁列）、輸入卡比正文兩側各寬 16
   cc ＝Claude 桌面版 Code：側欄 240、右欄 320、頂列 40、輸入框與正文同寬 */
const SPEC = {
  sideW: { dsh: 280, cc: 240 },
  rightW: { dsh: 300, cc: 320 },
  topH: { dsh: 76, cc: 40 },
  cardOverhang: { dsh: 16, cc: 0 },
  icon: 16,
};
const BAD = [
  /示例書/, /小說/, /閱讀器/, /閱讀中/, /未開始/, /讀到第/, /第\s*\d+\s*章/, /書架/, /藏書/, /字體大小/, /書名/, /目錄/,
  /示例书/, /小说/, /阅读器/, /阅读中/, /未开始/, /读到第/, /书架/, /藏书/, /字体大小/, /书名/, /目录/,
  /\bnovels?\b/i, /\bchapters?\b/i, /\bbookshel(f|ves)\b/i, /\bebook\b/i, /\breading progress\b/i,
];

const SIZES = [[1440, 900], [1180, 800], [1024, 768], [900, 700], [613, 789], [420, 844]];
const RUNS = [];
for (const s of SIZES) RUNS.push({ shell: 'dsh', theme: 'dsh-light', size: s });
for (const s of [[1440, 900], [1180, 800], [1024, 768], [613, 789], [420, 844]]) RUNS.push({ shell: 'cc', theme: 'claude', size: s });
RUNS.push({ shell: 'dsh', theme: 'dsh', size: [1280, 820] });
RUNS.push({ shell: 'cc', theme: 'claude-code', size: [613, 789] });

const results = [];
function check(id, run, ok, detail) {
  results.push({ id, run, ok: !!ok, detail });
  if (!ok) console.log(`  ❌ ${id} ${run} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

async function launch() {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt', 'book-' + BOOK + '.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DATA, f));
  }
  const cache = path.join(REAL, 'chapters');
  if (fs.existsSync(cache)) {
    fs.mkdirSync(path.join(DATA, 'chapters'), { recursive: true });
    for (const f of fs.readdirSync(cache)) if (f.endsWith('.json')) fs.copyFileSync(path.join(cache, f), path.join(DATA, 'chapters', f));
  }
  fs.writeFileSync(path.join(DATA, 'window.json'), JSON.stringify({ width: 1440, height: 900, x: 40, y: 40 }), 'utf8');
  const log = fs.openSync(path.join(ROOT, '_probe', 'layout-gate.log'), 'w');
  const child = spawn(EXE, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { try { child.kill(); } catch {} throw new Error('連不上偵錯埠 ' + PORT); }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  return { browser, page, child };
}

/* 量測引擎自檢：在畫面上放一個已知尺寸的框（fixed、最上層），量出來必須完全一樣，量完拿掉。
   （Electron 的偵錯協定不支援 Target.createTarget，不能另開合成頁） */
async function selftest(page) {
  const b = await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:17px;top:23px;width:123px;height:45px;z-index:2147483647;margin:0;padding:0;border:0';
    document.body.appendChild(d);
    const r = d.getBoundingClientRect();
    d.remove();
    return [r.left, r.top, r.width, r.height];
  });
  const ok = JSON.stringify(b) === JSON.stringify([17, 23, 123, 45]);
  check('selftest', 'engine', ok, b);
  return ok;
}

const SABOTAGE = ARGV.includes('--sabotage');
async function setup(page, run) {
  run = Object.assign({ sabotage: SABOTAGE }, run);
  await page.evaluate((cfg) => {
    /* 隱藏視窗（--hidden）裡 CSS transition 不會前進（跟 rAF、計時器一樣被凍住），
       抽屜會停在「開始位置」被量到 → 量測時關掉動效，量的是終點狀態。 */
    if (!document.getElementById('gate-no-motion')) {
      const s = document.createElement('style');
      s.id = 'gate-no-motion';
      s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
      document.head.appendChild(s);
    }
    /* --sabotage：故意弄壞（輸入卡偏 12px、側欄 300、頂欄按鈕被蓋、狀態列寫「目錄」），閘門必須紅 */
    if (cfg.sabotage && !document.getElementById('gate-sabotage')) {
      const s = document.createElement('style');
      s.id = 'gate-sabotage';
      s.textContent = ':root .app .composer{padding-left:36px!important}'
        + ':root .app .side{width:300px!important}'
        + ':root .topbar::after{content:"";position:absolute;right:0;top:0;width:120px;height:100%;z-index:99}'
        + ':root .topbar{position:relative}';
      document.head.appendChild(s);
      // 種在兩個殼都看得到、而且不會被定時重寫的地方（狀態列已不顯示；#sbTok 每秒重寫）
      document.querySelector('.side-actions')?.insertAdjacentHTML('beforeend', '<span class="gate-sab">目录</span>');
    }
    const D = window.__moyuDebug;
    D.setShell(cfg.shell); D.setTheme(cfg.theme);
    try { localStorage.setItem('moyu.sideOff', '0'); } catch {}
    document.querySelectorAll('.panel, .marks-panel, .stats-panel, .hist-panel, .phone-panel, .overflow, .detail').forEach((el) => { el.hidden = true; });
    document.querySelector('.cmdk')?.setAttribute('hidden', '');
    const app = document.querySelector('.app');
    app.classList.remove('side-open', 'toc-open');
    app.dataset.toc = '1';
    document.body.classList.remove('bossing');
  }, run);
  await page.evaluate((sz) => window.moyu?.win?.setState?.({ width: sz[0], height: sz[1] }), run.size);
  await sleep(700);
  await page.evaluate(() => window.__moyuLayoutPass && window.__moyuLayoutPass());
  await sleep(350);
}

function measure() {
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth; };
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const $ = (s) => document.querySelector(s);
  const app = $('.app');
  const thread = $('.thread'); const tcs = getComputedStyle(thread);
  const comp = $('.composer'); const ccs = getComputedStyle(comp);
  const tb = box(thread); const cb = box(comp);
  const topbar = box($('.topbar'));
  const kids = [...$('.topbar').children].filter(vis).map((el) => { const r = el.getBoundingClientRect(); return { id: el.id || el.className, cy: r.top + r.height / 2 }; });
  const btns = [...document.querySelectorAll('.topbar button')].filter(vis).map((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const svg = el.querySelector('svg');
    const sr = svg ? svg.getBoundingClientRect() : null;
    /* 圖示尺寸只管「只有圖示」的按鈕；字旁邊的小圖（dsh 小標籤、cc 標題旁的 ⌄）照真工具是 14 */
    const iconOnly = !el.textContent.trim() && !el.classList.contains('crumb-caret');
    return { id: el.id || el.className, hitOk: !!hit && (hit === el || el.contains(hit)), hit: hit ? (hit.id || hit.className || hit.tagName) : null, icon: sr && iconOnly ? [Math.round(sr.width), Math.round(sr.height)] : null };
  });
  const shellNow = document.documentElement.getAttribute('data-shell');
  const right = [...document.querySelectorAll('.dsh-right')].find(vis) || null;
  // 另一個殼的元素必須真的看不見（只算 .only-* 自己，不算它的子孫）
  const leak = [...document.querySelectorAll(shellNow === 'cc' ? '.only-dsh' : '.only-cc')].filter(vis).map((e) => e.id || e.className).slice(0, 5);
  const meta = $('#composerMeta');
  const metaBox = meta && vis(meta) && meta.children.length ? box(meta) : null;
  const inp = $('#input'); const ics = getComputedStyle(inp); const ib = box(inp);
  return {
    iw: innerWidth, ih: innerHeight, cls: app.className, shell: shellNow, leak,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    topbar, kids, btns,
    textL: tb.x + parseFloat(tcs.paddingLeft), textR: tb.r - parseFloat(tcs.paddingRight),
    boxL: cb.x + parseFloat(ccs.paddingLeft), boxR: cb.r - parseFloat(ccs.paddingRight),
    inputL: ib.x + parseFloat(ics.paddingLeft),
    box: box($('.composer .box')), meta: metaBox, stream: box($('#stream')),
    side: vis($('.side')) ? box($('.side')) : null, toc: right ? box(right) : null,
    bp: window.__moyuLayoutBreakpoints || null,
  };
}

async function runOne(page, run) {
  const tag = `${run.shell}/${run.theme}@${run.size.join('x')}`;
  await setup(page, run);
  const m = await page.evaluate(measure);
  const w = m.iw;
  const bp = m.bp || { side: 900, toc: 1180 };
  const sh = run.shell;

  check('G1 不橫向捲動', tag, m.overflowX === 0, { overflowX: m.overflowX });
  check('G0 另一個殼的元素看不見', tag, m.leak.length === 0, m.leak);
  check('G2 頂部高度', tag, Math.abs(m.topbar.h - SPEC.topH[sh]) <= 1, { got: m.topbar.h, want: SPEC.topH[sh] });
  if (sh === 'cc') {
    const spread = Math.max(...m.kids.map((k) => k.cy)) - Math.min(...m.kids.map((k) => k.cy));
    check('G2 頂列單列', tag, spread <= 2, { spread, kids: m.kids });
  }
  /* G3 同軸：輸入卡的內緣＝正文欄內緣；dsh 的卡片兩側各外擴 16，卡裡的字跟正文左緣對齊 */
  const oh = SPEC.cardOverhang[sh];
  check('G3 正文與輸入卡同軸', tag,
    Math.abs(m.textL - m.boxL) <= 1 && Math.abs(m.textR - m.boxR) <= 1
    && Math.abs(m.box.x - (m.textL - oh)) <= 1 && Math.abs(m.box.r - (m.textR + oh)) <= 1,
    { text: [m.textL, m.textR], composer: [m.boxL, m.boxR], card: [m.box.x, m.box.r], overhang: oh });
  if (sh === 'dsh') check('G3 卡片裡的字跟正文左緣對齊', tag, Math.abs(m.inputL - m.textL) <= 2, { input: m.inputL, text: m.textL });

  const drawer = w < bp.side;
  if (drawer) {
    check('G4 側欄是抽屜（收著）', tag, /side-drawer/.test(m.cls) && !m.side, { cls: m.cls, side: m.side });
  } else {
    check('G4 側欄在版面裡', tag, !!m.side && Math.abs(m.side.x) <= 1 && Math.abs(m.side.w - SPEC.sideW[sh]) <= 1, { side: m.side, want: SPEC.sideW[sh] });
  }
  if (w >= bp.toc) {
    check('G5 右欄停靠', tag, !!m.toc && Math.abs(m.toc.w - SPEC.rightW[sh]) <= 1 && Math.abs(m.toc.r - w) <= 1, { toc: m.toc, want: SPEC.rightW[sh] });
  } else {
    check('G5 右欄是抽屜（收著）', tag, /toc-overlay/.test(m.cls) && !m.toc, { cls: m.cls, toc: m.toc });
  }
  /* G6 輸入卡下面那一行（dsh＝統計、cc＝模型與權限）在畫面內 */
  check('G6 卡片下一行在畫面內', tag, !!m.meta && m.meta.b <= m.ih + 1 && m.meta.y >= m.box.b - 1, { meta: m.meta, boxB: m.box.b, ih: m.ih });
  const badIcon = m.btns.filter((b) => b.icon && (b.icon[0] !== SPEC.icon || b.icon[1] !== SPEC.icon));
  check('G7 頂部圖示 16px', tag, badIcon.length === 0, badIcon);
  check('G8 輸入卡在視窗底之上', tag, m.box.b <= m.ih, { box: m.box.b, ih: m.ih });
  check('G9 對話流在頂欄與輸入卡之間', tag, Math.abs(m.stream.y - m.topbar.b) <= 1 && m.stream.b <= m.box.y + 1,
    { stream: [m.stream.y, m.stream.b], topbarB: m.topbar.b, boxY: m.box.y });
  if (drawer && w < bp.toc) {
    check('G10 窄視窗正文欄拿滿寬度', tag, Math.abs(m.stream.w - w) <= 1, { stream: m.stream.w, iw: w });
  }
  const dead = m.btns.filter((b) => !b.hitOk);
  check('G12 頂欄按鈕點得到', tag, dead.length === 0, dead);

  /* G11 抽屜：開、看、點遮罩關 */
  if (drawer) {
    await page.click('#tbSide');
    await sleep(380);
    const o = await page.evaluate(() => {
      const s = document.querySelector('.side').getBoundingClientRect();
      const scrim = getComputedStyle(document.querySelector('.app'), '::after').opacity;
      return { open: document.querySelector('.app').classList.contains('side-open'), x: s.left, w: s.width, vis: getComputedStyle(document.querySelector('.side')).visibility, scrim };
    });
    check('G11 側欄抽屜打得開', tag, o.open && Math.abs(o.x) <= 1 && o.w > 200 && o.vis === 'visible' && Number(o.scrim) > 0.9, o);
    await page.mouse.click(m.iw - 20, Math.round(m.ih / 2));
    await sleep(380);
    const c = await page.evaluate(() => document.querySelector('.app').classList.contains('side-open'));
    check('G11 點遮罩關側欄', tag, !c, { stillOpen: c });
  }
  if (w < bp.toc) {
    await page.click('#tbList');
    await sleep(380);
    const o = await page.evaluate((s) => {
      const el = document.querySelector(s === 'cc' ? '#ccPanel' : '#tocPanel');
      const r = el.getBoundingClientRect();
      return { open: document.querySelector('.app').classList.contains('toc-open'), r: r.right, w: r.width, iw: innerWidth, vis: getComputedStyle(el).visibility };
    }, sh);
    check('G11 右欄抽屜打得開', tag, o.open && Math.abs(o.r - o.iw) <= 1 && o.w > 200 && o.vis === 'visible', o);
    await page.mouse.click(20, Math.round(m.ih / 2));
    await sleep(380);
    const c = await page.evaluate(() => document.querySelector('.app').classList.contains('toc-open'));
    check('G11 點遮罩關右欄', tag, !c, { stillOpen: c });
  }
  return m;
}

/* G13 外殼文字：只看「殼」，不看正文、書名、檔名（那些是內容，可以出現第 N 章） */
async function disguise(page) {
  for (const sh of ['dsh', 'cc']) {
    await setup(page, { shell: sh, theme: sh === 'cc' ? 'claude' : 'dsh-light', size: [1440, 900] });
    await page.evaluate(() => window.__moyuShellPlace && window.__moyuShellPlace());
    await sleep(200);
    const shellText = await page.evaluate(() => {
      const parts = [];
      const take = (el) => {
        if (!el) return;
        const c = el.cloneNode(true);
        /* 內容不算外殼：正文、章名、書名（工作區名／專案名／Outputs 檔名）——書名本身可能就叫「第7章…」 */
        c.querySelectorAll('#crumb, #bookName, .sr-t, .nm, .p, .bubble, .hr-t, .hb-t, .hc-t, .hs-t, .ws-name, .cc-proj-name, .ccp-l, .ccp-file span, #tree').forEach((n) => n.remove());
        c.querySelectorAll('.sr-row, .ws-folder, [data-book]').forEach((n) => n.removeAttribute('title'));
        parts.push(c.textContent);
        [c, ...c.querySelectorAll('[title],[placeholder],[aria-label]')].forEach((n) => parts.push(n.getAttribute('title') || '', n.getAttribute('placeholder') || '', n.getAttribute('aria-label') || ''));
      };
      ['.titlebar', '.topbar', '.side', '.composer', '#tocPanel .panel-head', '#tocPanel .find', '.vol', '.overflow', '#ccPanel']
        .forEach((s) => document.querySelectorAll(s).forEach(take));
      // ::before 畫出來的字（例如 dsh 的「工作区」）也算
      document.querySelectorAll('.side-region-head').forEach((n) => parts.push(getComputedStyle(n, '::before').content || ''));
      return parts.join(' ');
    });
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await sleep(400);
    const pal = await page.evaluate(() => [...document.querySelectorAll('.cmdk-row')].map((r) => r.textContent).join(' '));
    await page.keyboard.press('Escape');
    const all = shellText + ' ' + pal;
    const hits = BAD.map((re) => (all.match(re) || [])[0]).filter(Boolean);
    check('G13 外殼文字無偽裝黑名單', sh + '@1440', hits.length === 0 && pal.length > 0, { hits, paletteRows: pal.length > 0 });
  }
}

(async () => {
  fs.mkdirSync(path.join(ROOT, '_probe'), { recursive: true });
  const { browser, page, child } = await launch();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  try {
    const engineOk = await selftest(page);
    if (!engineOk) throw new Error('量測引擎自檢失敗，下面的數字不可信');
    if (ARGV.includes('--selftest')) { console.log('✅ 量測引擎自檢通過'); return; }
    await sleep(1400);
    await page.evaluate((b) => window.__moyuDebug.openBook(b), BOOK);
    for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 5)) break; await sleep(400); }
    await sleep(900);
    for (const run of RUNS) await runOne(page, run);
    await disguise(page);
  } catch (e) {
    check('harness', 'run', false, String(e && e.stack || e));
  } finally {
    check('G0 沒有 pageerror', 'all', errors.length === 0, errors.slice(0, 5));
    const fail = results.filter((r) => !r.ok);
    fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), spec: SPEC, results }, null, 1), 'utf8');
    console.log(`\n${fail.length ? '❌' : '✅'} layout-gate：${results.length - fail.length}/${results.length} 通過（報告 ${path.relative(ROOT, REPORT)}）`);
    try { browser.disconnect(); } catch {}
    try { child.kill(); } catch {}
    process.exitCode = fail.length ? 1 : 0;
  }
})();
