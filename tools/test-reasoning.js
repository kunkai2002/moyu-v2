// 思考鏈（ui/reasoning.js）無頭驗收
//   node tools/test-reasoning.js
// ─────────────────────────────────────────────────────────────
// 用 --hidden 起本專案（file://），開真書（章節快取照抄到 _probe/reasoning-data，
// 不碰 JOJO 的進度）。驗：
//   ① 每則助手回覆（.turn.ai 有 .pb）前有且只有一個 .think，且就在 .pb 前面
//   ② header 從「思考中 · N.Ns」→「已完成思考 · N.Ns · N tok」，秒數真的在跳
//   ③ 每塊至少一次「先閃再定稿」（同一行先短句、200–400ms 後換定稿）；全長 2–5 秒
//   ④ 推理行 2–5 行、逐行出現（間隔 300–700ms）、文字像真的在推理、沒有外殼黑名單字
//   ⑤ 點 header 展開／收合，展開喜好記 localStorage.moyu.think.doneOpen（下一塊沿用）
//   ⑥ 段落 data-pi 索引不受影響；.think 不是 .p、也沒有 data-pi
//   ⑦ 元件不自動捲動（block 出現→跑完的 scrollTop 不變）
//   ⑧ prefers-reduced-motion：無 animation／transition、行直接全部顯示、不閃
//   ⑨ 重掃不重複插；無 pageerror／console error
// 截圖：_probe/reasoning-run.png／reasoning-open.png／reasoning-done.png／reasoning-light.png
// 結果：_probe/reasoning.json（含逐項 pass/fail）
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(ROOT, '_probe');
const DATA = path.join(OUT, 'reasoning-data');
const PORT = 9387;   // 不要跟 shot-matrix(9371)／shot-shell(9367) 撞；撞到會連到別人的實例
const BOOK = '7143038691944959011';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, cond, extra) {
  results.push({ pass: !!cond, name, extra: extra == null ? '' : String(extra) });
  console.log((cond ? '✅' : '❌'), name, extra == null ? '' : String(extra));
}
const fmt = (v) => JSON.stringify(v);

function prepareData() {
  // 上一個測試的 electron 若還在收尾，資料夾會鎖住：退一步再刪
  for (let i = 0; ; i++) {
    try { fs.rmSync(DATA, { recursive: true, force: true }); break; }
    catch (e) {
      if (i >= 4) throw e;
      const t = Date.now();
      while (Date.now() - t < 500) { /* wait */ }
    }
  }
  fs.mkdirSync(DATA, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DATA, f));
  }
  // 章節快取照抄（只讀），沒有它開書就要重抓
  const cacheSrc = path.join(REAL, 'chapters');
  if (fs.existsSync(cacheSrc)) {
    fs.mkdirSync(path.join(DATA, 'chapters'), { recursive: true });
    for (const f of fs.readdirSync(cacheSrc)) {
      if (f.endsWith('.json')) fs.copyFileSync(path.join(cacheSrc, f), path.join(DATA, 'chapters', f));
    }
  }
  fs.writeFileSync(path.join(DATA, 'window.json'),
    JSON.stringify({ width: 1440, height: 900, x: 60, y: 40, maximized: false }), 'utf8');
}

async function poll(fn, arg, timeout, step) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn(arg);
    if (v) return v;
    if (Date.now() - t0 > timeout) return null;
    await sleep(step || 60);
  }
}

(async () => {
  if (!fs.existsSync(ELECTRON)) { console.error('找不到 electron.exe：' + ELECTRON); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  /* 埠被別的測試實例占著時，connect 會連到別人身上（然後對方一關就 Target closed），先擋掉 */
  try {
    const other = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}` });
    other.disconnect();
    console.error('偵錯埠 ' + PORT + ' 已被別的 Electron 實例占用，先關掉再跑');
    process.exit(2);
  } catch (e) {}
  prepareData();
  const log = fs.openSync(path.join(OUT, 'reasoning.log'), 'w');
  const child = spawn(ELECTRON,
    [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden',
      // 無頭視窗的合成器會節流，screenshot 會延遲 2–3 秒抓到「已經跑完」的畫面；這些開關讓它照常出幀
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  // 任何結束方式（包含中途例外）都要把整個程序樹收掉，不然下次會鎖住 _probe/reasoning-data
  process.on('exit', () => {
    try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch (e) {}
  });

  let browser = null;
  for (let i = 0; i < 70 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 }); } catch (e) {}
  }
  if (!browser) { console.error('連不上偵錯埠 ' + PORT); process.exit(2); }

  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  if (!page) { console.error('找不到 app 頁面'); process.exit(2); }

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await sleep(1600);

  /* ── 0. 元件有沒有被 index.html 接上（還沒接就由測試端注入）── */
  let injected = false;
  const wired = await page.evaluate(() => !!(window.__moyuReasoning));
  if (!wired) {
    await page.addStyleTag({ path: path.join(ROOT, 'ui', 'reasoning.css') });
    await page.addScriptTag({ path: path.join(ROOT, 'ui', 'reasoning.js') });
    injected = true;
  }
  const loaded = await page.evaluate(() => !!(window.__moyuReasoning));
  check('元件載入', loaded, injected ? '測試端注入（index.html 尚未接線）' : 'index.html 已接線');

  /* ── 素材池＋抽選統計（200 次，直接打元件自己的 pickGroup；正式 attach 也走同一支）── */
  const sample = await page.evaluate(() => {
    const R = window.__moyuReasoning;
    const out = { pools: R.pools, groups: [] };
    for (let i = 0; i < 200; i++) out.groups.push(R.pickGroup());
    return out;
  });
  const OP_RE = /^(Read|Grep|Edit|Run|Typecheck|Test|Diff|Format|Search|Git|Lint|Build)\(/;
  const groups = sample.groups || [];
  const sigs = groups.map((g) => g.sig);
  const distinctSigs = new Set(sigs).size;
  const consecutiveSame = sigs.filter((s, i) => i > 0 && s === sigs[i - 1]).length;
  const withOps = groups.filter((g) => g.lines.some((l) => l.op)).length;
  const opRatio = groups.length ? withOps / groups.length : 0;
  const opLines = groups.flatMap((g) => g.lines.filter((l) => l.op));
  const allLines = groups.flatMap((g) => g.lines);
  const badOpText = opLines.filter((l) => !OP_RE.test(l.text));
  const badOpGlyph = opLines.filter((l) => !['⏺', '●'].includes(l.glyph));
  const badThoughtGlyph = allLines.filter((l) => !l.op && l.glyph !== '·');
  const sameTypeAdjacent = groups.reduce((n, g) => {
    for (let i = 1; i < g.lines.length; i++) {
      if (g.lines[i].op && g.lines[i - 1].op && g.lines[i].type === g.lines[i - 1].type) n++;
    }
    return n;
  }, 0);
  const badSizes = groups.filter((g) => g.lines.length < 2 || g.lines.length > 5);
  const noThought = groups.filter((g) => !g.lines.some((l) => !l.op));
  const badChars = allLines.filter((l) => /[書章節讀頁]|目錄|小說|閱讀/.test(l.text));
  const opTextSet = new Set(opLines.map((l) => l.text));
  const variants = {};
  for (const l of opLines) {
    variants[l.type] = variants[l.type] || new Set();
    variants[l.type].add(l.text);
  }
  check('素材池：思考 ≥46、操作 ≥10', !!sample.pools && sample.pools.thoughts >= 46 && sample.pools.ops >= 10,
    `思考 ${sample.pools && sample.pools.thoughts}、操作 ${sample.pools && sample.pools.ops}（${(sample.pools && sample.pools.opTypes || []).join('/')}）`);
  check('200 次抽選：每組 2–5 條、至少 1 條思考', badSizes.length === 0 && noThought.length === 0,
    `badSizes=${badSizes.length}、noThought=${noThought.length}`);
  check('200 次抽選：相異組合 ≥30', distinctSigs >= 30, `相異 ${distinctSigs}/${groups.length}`);
  check('200 次抽選：連續兩次相同 = 0', consecutiveSame === 0, `連續相同 ${consecutiveSame}`);
  check('200 次抽選：含操作記錄 60–85%', opRatio >= 0.60 && opRatio <= 0.85,
    `${withOps}/${groups.length} = ${(opRatio * 100).toFixed(1)}%`);
  check('操作記錄格式符合 12 種前綴', opLines.length > 0 && badOpText.length === 0,
    badOpText.length ? badOpText.map((l) => l.text).join(' ／ ') : `${opLines.length} 條操作記錄`);
  check('操作記錄每條都有 glyph（⏺／●）', opLines.length > 0 && badOpGlyph.length === 0 && badThoughtGlyph.length === 0,
    badOpGlyph.length ? badOpGlyph.map((l) => l.text).join(' ／ ') : `操作 ${opLines.length} 條、思考 glyph 也正確`);
  check('操作記錄不連續兩條同型', sameTypeAdjacent === 0, `同型相鄰 ${sameTypeAdjacent} 次`);
  check('操作記錄參數是隨機組合', opTextSet.size >= 40
    && (variants.Read ? variants.Read.size : 0) >= 3
    && (variants.Diff ? variants.Diff.size : 0) >= 3
    && (variants.Run ? variants.Run.size : 0) >= 3,
    `不同操作字串 ${opTextSet.size} 種；Read ${variants.Read ? variants.Read.size : 0}、Diff ${variants.Diff ? variants.Diff.size : 0}、Run ${variants.Run ? variants.Run.size : 0} 種變體`);
  check('素材沒有外殼黑名單（書／章／節／讀／頁／目錄）', badChars.length === 0,
    badChars.length ? badChars.slice(0, 3).map((l) => l.text).join(' ／ ') : `${allLines.length} 條素材`);

  await page.evaluate(() => {
    window.__moyuDebug.setShell('dsh');
    window.__moyuDebug.setTheme('dsh');
  });
  await sleep(400);

  /* ── 記錄器：抓每一行 .think-tx 的文字變化（初版＋flash 換字）── */
  await page.evaluate(() => {
    window.__rzLog = [];
    const stream = document.querySelector('#stream');
    if (!stream) return;
    const idx = (rz, tx) => Array.prototype.indexOf.call(rz.querySelectorAll('.think-tx'), tx);
    const push = (tx, t) => {
      const rz = tx.closest('.think');
      if (!rz) return;
      window.__rzLog.push({ id: rz.dataset.tid || '?', i: idx(rz, tx), text: tx.textContent || '', t: Math.round(t) });
    };
    const mo = new MutationObserver((muts) => {
      const t = performance.now();
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          const txs = n.matches && n.matches('.think-tx') ? [n] : (n.querySelectorAll ? Array.from(n.querySelectorAll('.think-tx')) : []);
          for (const tx of txs) push(tx, t);
        }
        let el = m.target;
        if (el && el.nodeType === 3) el = el.parentElement;
        if (el && el.closest) {
          const tx = el.closest('.think-tx');
          if (tx) push(tx, t);
        }
      }
    });
    mo.observe(stream, { childList: true, subtree: true, characterData: true });
    window.__rzMo = mo;
  });

  /* ── 開真書（只讀快取）── */
  await page.evaluate(async (id) => {
    try { await window.__moyuDebug.openBook(id); } catch (e) {}
  }, BOOK);
  const opened = await poll(async () => page.evaluate(() =>
    document.querySelectorAll('#stream .p').length > 5 && document.querySelectorAll('#stream .think').length > 0
  ), null, 16000, 300);
  check('開真書、正文與思考塊都出現', !!opened, opened ? '' : '16s 內沒看到 .p/.think');

  // 等第一批思考塊全部跑完
  const settled = await poll(async () => page.evaluate(() => {
    const rzs = Array.from(document.querySelectorAll('#stream .think'));
    if (!rzs.length) return null;
    return rzs.every((r) => r.dataset.state === 'done') ? true : null;
  }), null, 14000, 250);
  check('思考塊會自己結束（不會卡在思考中）', !!settled, settled ? '' : '14s 內還有 block 沒有 done');

  /* ── ① 結構：每則助回覆前有且只有一個 .think ── */
  const struct = await page.evaluate(() => {
    const turns = Array.from(document.querySelectorAll('#stream .turn.ai'));
    const withBody = turns.filter((t) => t.querySelector('.pb'));
    const rows = withBody.map((t) => {
      const b = t.querySelector(':scope > .b');
      const pb = b && b.querySelector(':scope > .pb');
      const rzs = b ? Array.from(b.children).filter((x) => x.classList && x.classList.contains('think')) : [];
      const rz = rzs[0] || null;
      const before = !!(rz && pb && ((rz.compareDocumentPosition(pb) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0));
      return {
        ci: pb && pb.dataset.ci, part: pb && pb.dataset.part,
        thinkCount: rzs.length,
        sameParent: !!(rz && rz.parentElement === b),
        before,
        pInside: rz ? rz.querySelectorAll('.p').length : 0,
        piInside: rz ? rz.querySelectorAll('[data-pi]').length : 0,
        state: rz ? rz.dataset.state : '',
        header: rz ? rz.querySelector('.think-h').textContent.replace(/\s+/g, ' ').trim() : '',
        label: rz ? rz.querySelector('.think-t').textContent : '',
        sec: rz ? rz.querySelector('.think-sec').textContent : '',
        tok: rz ? rz.querySelector('.think-tok').textContent : '',
        t0: rz ? Number(rz.dataset.t0) : 0,
        t1: rz ? Number(rz.dataset.t1) : 0,
        open: rz ? rz.dataset.open : '',
        lines: rz ? Array.from(rz.querySelectorAll('.think-l')).map((l) => ({
          text: l.querySelector('.think-tx').textContent,
          op: l.classList.contains('think-op'),
          glyph: (l.querySelector('.think-bu') || {}).textContent || '',
        })) : [],
      };
    });
    return {
      turnCount: turns.length,
      withBody: withBody.length,
      thinkTotal: document.querySelectorAll('#stream .think').length,
      pCount: document.querySelectorAll('#stream .p').length,
      rows,
    };
  });
  check('每則助手回覆前有且只有一個 .think',
    struct.rows.length > 0 && struct.rows.every((r) => r.thinkCount === 1) && struct.thinkTotal === struct.rows.length,
    `助手回覆 ${struct.withBody} 則、.think ${struct.thinkTotal} 塊`);
  check('.think 就在 .pb 前面、同一個 .b', struct.rows.every((r) => r.sameParent && r.before));
  check('.think 不是 .p、也沒有 data-pi（段落索引不受影響）', struct.rows.every((r) => r.pInside === 0 && r.piInside === 0));
  const scale = await page.evaluate(() => {
    const t = document.querySelector('#stream .think');
    if (!t) return null;
    const cs = getComputedStyle(t);
    const r = t.getBoundingClientRect();
    return { fs: cs.fontSize, lh: cs.lineHeight, pos: cs.position, width: Math.round(r.width), cls: t.className };
  });
  check('推理塊尺度 12/20、正常寬度（.think，沒被側欄拖曳柄的 .rz 污染）',
    !!scale && scale.fs === '12px' && scale.lh === '20px' && scale.pos === 'static'
      && scale.width > 200 && scale.cls === 'think',
    fmt(scale));
  check('header 是「已完成思考 · N.Ns · N tok」',
    struct.rows.every((r) => r.state === 'done' && r.label === '已完成思考'
      && /^\d+\.\d+s$/.test(r.sec) && /^[\d,]+ tok$/.test(r.tok)
      && /已完成思考\s*·\s*\d+\.\d+s\s*·\s*[\d,]+ tok/.test(r.header)),
    struct.rows.slice(0, 2).map((r) => r.header).join(' ／ '));
  check('思考長度 2–5 秒',
    struct.rows.every((r) => r.t1 - r.t0 >= 1900 && r.t1 - r.t0 <= 5400),
    struct.rows.map((r) => ((r.t1 - r.t0) / 1000).toFixed(1) + 's').join(' / '));
  check('推理行 2–5 行、思考句短句、操作行格式正確',
    struct.rows.every((r) => r.lines.length >= 2 && r.lines.length <= 5
      && r.lines.filter((l) => !l.op).every((l) => l.text.length > 0 && l.text.length <= 32)
      && r.lines.filter((l) => l.op).every((l) => OP_RE.test(l.text) && ['⏺', '●'].includes(l.glyph))),
    struct.rows.map((r) => r.lines.length + ' 行（操作 ' + r.lines.filter((l) => l.op).length + '）').join(' / '));
  check('推理文字沒有外殼黑名單（書／章／節／讀／頁／目錄）',
    struct.rows.every((r) => r.lines.every((l) => !/[書章節讀頁]|目錄|小說|閱讀/.test(l.text))),
    struct.rows[0] ? struct.rows[0].lines.slice(0, 3).map((l) => l.text).join(' ／ ') : '');
  const renderedOps = struct.rows.flatMap((r) => r.lines.filter((l) => l.op));
  check('渲染出的操作行：.think-op ＋ glyph ＋ 格式',
    renderedOps.every((l) => OP_RE.test(l.text) && ['⏺', '●'].includes(l.glyph)),
    `這次渲染 ${renderedOps.length} 條操作記錄` + (renderedOps.length ? '（' + renderedOps.slice(0, 2).map((l) => l.text).join(' ／ ') + '）' : ''));

  /* ── ⑤ 展開／收合＋localStorage ── */
  const toggle = await page.evaluate(() => {
    const rz = document.querySelector('.think[data-state="done"]');
    if (!rz) return null;
    const h = rz.querySelector('.think-h');
    const body = rz.querySelector('.think-body');
    const snap = () => ({
      open: rz.dataset.open,
      disp: getComputedStyle(body).display,
      height: body.offsetHeight,
      stored: localStorage.getItem('moyu.think.doneOpen'),
      aria: h.getAttribute('aria-expanded'),
    });
    const before = snap();
    h.click();
    const opened = snap();
    h.click();
    const closed = snap();
    h.click();               // 留成展開，下一塊要驗「喜好沿用」
    const reopened = snap();
    return { before, opened, closed, reopened };
  });
  check('結束後預設收合成單行', !!toggle && toggle.before.open === '0'
    && toggle.before.disp === 'none' && toggle.before.aria === 'false', toggle ? fmt(toggle.before) : '找不到 done 塊');
  check('點一下展開（body 出現、localStorage=1）',
    !!toggle && toggle.opened.open === '1' && toggle.opened.disp !== 'none'
      && toggle.opened.height > 0 && toggle.opened.stored === '1' && toggle.opened.aria === 'true',
    toggle ? fmt(toggle.opened) : '');
  check('再點一下收合（localStorage=0）',
    !!toggle && toggle.closed.open === '0' && toggle.closed.stored === '0'
      && toggle.closed.aria === 'false', toggle ? fmt(toggle.closed) : '');
  check('再展開後喜好＝1（下一塊會沿用）', !!toggle && toggle.reopened.stored === '1', toggle ? fmt(toggle.reopened) : '');

  /* ── ⑦ 追加一章：不自動捲動 + 進行中 header 跳秒 + 逐行 + flash ── */
  /* 把 #stream 的 scrollTop setter 包起來：只有「JS 去寫」會記錄；
     瀏覽器自己的 scroll anchoring 不走 setter，要用畫面參考段另外量。 */
  await page.evaluate(() => {
    const s = document.querySelector('#stream');
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    window.__scrollWrites = [];
    Object.defineProperty(s, 'scrollTop', {
      configurable: true,
      get() { return d.get.call(this); },
      set(v) {
        window.__scrollWrites.push({
          v: Math.round(v), t: Math.round(performance.now()),
          stack: String(new Error().stack || '').split('\n').slice(2, 5).join(' | '),
        });
        d.set.call(this, v);
      },
    });
  });
  const beforeAdd = await page.evaluate(() => ({
    ids: Array.from(document.querySelectorAll('#stream .think')).map((r) => r.dataset.tid),
    pi: (() => {
      const pb = document.querySelector('#stream .pb');
      return pb ? Array.from(pb.querySelectorAll('.p')).map((p) => p.dataset.pi) : [];
    })(),
  }));
  await page.evaluate(() => {
    const D = window.__moyuDebug;
    const i = Math.min(D.state.index + 1, D.state.chapters.length - 1);
    D.goChapter(i, { autoAppend: true }).catch(() => {});
  });
  const running = await poll(async (ids) => page.evaluate((seen) => {
    const rzs = Array.from(document.querySelectorAll('#stream .think')).filter((r) => seen.indexOf(r.dataset.tid) < 0);
    if (!rzs.length) return null;
    const rz = rzs[rzs.length - 1];
    return {
      id: rz.dataset.tid,
      state: rz.dataset.state,
      label: rz.querySelector('.think-t').textContent,
      sec: rz.querySelector('.think-sec').textContent,
      lines: rz.querySelectorAll('.think-l').length,
      newCount: rzs.length,
      total: document.querySelectorAll('#stream .think').length,
      scrollTop: document.querySelector('#stream').scrollTop,
      spin: !!rz.querySelector('.think-spin'),
      arrow: !!rz.querySelector('.think-car'),
    };
  }, ids), beforeAdd.ids, 12000, 60);
  check('追加章節後多出新思考塊', !!running, running ? `新塊 ${running.newCount} 個` : '12s 內沒出現');

  if (running) {
    const probe = await page.evaluate(() => {
      const s = document.querySelector('#stream');
      const sr = s.getBoundingClientRect();
      /* 參考段要挑「不是最新那一則回覆」的段落：推理塊是加在新回覆的最前面、
         而且會逐行長高，新回覆自己的段落被往下推是正常排版（真實工具也一樣）。
         要驗的是「已經在畫面上的舊內容不該被推走」。 */
      const turns = Array.from(s.querySelectorAll('.turn.ai'));
      const lastTurn = turns[turns.length - 1];
      const ref = Array.from(s.querySelectorAll('.p'))
        .filter((p) => !(lastTurn && lastTurn.contains(p)))
        .find((p) => {
          const r = p.getBoundingClientRect();
          return r.bottom > sr.top + 20 && r.top < sr.bottom - 20;
        });
      window.__refEl = ref || null;
      window.__probeMark = performance.now();
      window.__scrollWrites.length = 0;
      return {
        scrollTop: Math.round(s.scrollTop),
        refTop: ref ? Math.round(ref.getBoundingClientRect().top) : null,
        refText: ref ? (ref.textContent || '').slice(0, 16) : '',
      };
    });

    check('進行中 header＝spinner＋「思考中」＋跳秒＋箭頭',
      running.state === 'run' && running.label === '思考中'
        && /^\d+\.\d+s$/.test(running.sec) && running.spin && running.arrow,
      fmt({ state: running.state, label: running.label, sec: running.sec, spin: running.spin, arrow: running.arrow }));

    await sleep(1200);
    const during = await page.evaluate((id) => {
      const rz = document.querySelector('.think[data-tid="' + id + '"]');
      if (!rz) return null;
      const s = document.querySelector('#stream');
      const ref = window.__refEl;
      return {
        sec: rz.querySelector('.think-sec').textContent,
        label: rz.querySelector('.think-t').textContent,
        lines: rz.querySelectorAll('.think-l').length,
        scrollTop: Math.round(s.scrollTop),
        refTop: ref && ref.isConnected ? Math.round(ref.getBoundingClientRect().top) : null,
        jsWrites: (window.__scrollWrites || []).filter((w) => w.t >= window.__probeMark),
      };
    }, running.id);
    const jsWrites = (during && during.jsWrites) || [];
    check('秒數在跳（0.3s 內至少變一次）', !!during && during.sec !== running.sec && /^\d+\.\d+s$/.test(during.sec),
      running.sec + ' → ' + (during ? during.sec : '?'));
    check('推理行是逐行出現的', !!during && running.lines <= during.lines && during.lines >= 2,
      `剛出現 ${running.lines} 行 → 1.2s 後 ${during ? during.lines : '?'} 行`);
    check('元件不自動捲動（思考中階段：沒有任何 JS 去寫 #stream.scrollTop）',
      !!during && jsWrites.filter((w) => w.stack.indexOf('reasoning.js') >= 0).length === 0,
      jsWrites.length ? fmt(jsWrites.map((w) => ({ v: w.v, from: (w.stack.match(/([^\\/]+\.js):\d+/) || [])[1] || '?' }))) : '沒有任何 JS 寫入');
    check('元件不自動捲動（思考中階段：畫面上的參考段不移動）',
      /* 推理塊在新回覆裡長高、把下面內容往下推是正常排版（真實工具也一樣）。
         要守的是「元件不主動捲頁」：沒有任何 reasoning.js 寫 scrollTop，且捲動量有界。 */
      !!during && jsWrites.filter((w) => w.stack.indexOf('reasoning.js') >= 0).length === 0
        && Math.abs((during.refTop || probe.refTop) - probe.refTop) <= 140,
      `參考段 ${probe.refText}… top ${probe.refTop} → ${during ? during.refTop : '?'}；scrollTop ${probe.scrollTop} → ${during ? during.scrollTop : '?'}（瀏覽器 scroll anchoring 可能自己補償，不算元件在捲）`);

    const doneInfo = await poll(async (id) => page.evaluate((rid) => {
      const rz = document.querySelector('.think[data-tid="' + rid + '"]');
      if (!rz || rz.dataset.state !== 'done') return null;
      const stream = document.querySelector('#stream');
      const ref = window.__refEl;
      return {
        label: rz.querySelector('.think-t').textContent,
        header: rz.querySelector('.think-h').textContent.replace(/\s+/g, ' ').trim(),
        sec: rz.querySelector('.think-sec').textContent,
        tok: rz.querySelector('.think-tok').textContent,
        open: rz.dataset.open,
        t0: Number(rz.dataset.t0),
        t1: Number(rz.dataset.t1),
        lines: Array.from(rz.querySelectorAll('.think-l')).map((l) => l.querySelector('.think-tx').textContent),
        scrollTop: Math.round(stream.scrollTop),
        refTop: ref && ref.isConnected ? Math.round(ref.getBoundingClientRect().top) : null,
        jsWrites: (window.__scrollWrites || []).filter((w) => w.t >= window.__probeMark),
      };
    }, id), running.id, 8000, 150);
    check('進行中 → 已完成思考 · N.Ns · N tok',
      !!doneInfo && doneInfo.label === '已完成思考'
        && /^\d+\.\d+s$/.test(doneInfo.sec) && /^[\d,]+ tok$/.test(doneInfo.tok)
        && /已完成思考\s*·\s*\d+\.\d+s\s*·\s*[\d,]+ tok/.test(doneInfo.header),
      doneInfo ? doneInfo.header : '8s 內沒完成');
    check('新塊沿用展開喜好（localStorage=1）', !!doneInfo && doneInfo.open === '1',
      doneInfo ? 'data-open=' + doneInfo.open : '');
    check('跑完整塊也沒把畫面捲走（JS 沒寫 scrollTop、參考段不移動）',
      !!doneInfo && (doneInfo.jsWrites || []).filter((w) => w.stack.indexOf('reasoning.js') >= 0).length === 0
        && probe.refTop != null && doneInfo.refTop != null && Math.abs(doneInfo.refTop - probe.refTop) <= 120,
      doneInfo ? `參考段 top ${probe.refTop} → ${doneInfo.refTop}；scrollTop ${probe.scrollTop} → ${doneInfo.scrollTop}；JS 寫入 ${(doneInfo.jsWrites || []).length}` : '');
    check('思考長度 2–5 秒（追加的那塊）',
      !!doneInfo && doneInfo.t1 - doneInfo.t0 >= 1900 && doneInfo.t1 - doneInfo.t0 <= 5400,
      doneInfo ? ((doneInfo.t1 - doneInfo.t0) / 1000).toFixed(1) + 's' : '');

    /* flash：同一行先短後定；「規劃停留」寫在 row.dataset.flash，驗 200–400ms 的設計值；
       實際換字時間會受無頭環境的長任務影響，只驗「不早於規劃、延後有上限」。 */
    const log = await page.evaluate(() => window.__rzLog);
    const planned = await page.evaluate((id) => Array.from(
      document.querySelectorAll('.think[data-tid="' + id + '"] .think-l')
    ).map((l) => (l.dataset.flash ? Number(l.dataset.flash) : 0)), running.id);
    const byLine = new Map();
    for (const e of log) {
      if (e.id !== running.id) continue;
      const key = e.i;
      if (!byLine.has(key)) byLine.set(key, []);
      const h = byLine.get(key);
      if (!h.length || h[h.length - 1].text !== e.text) h.push({ text: e.text, t: e.t });
    }
    const histEntries = Array.from(byLine.entries()).sort((a, b) => a[0] - b[0]);
    const hist = histEntries.map(([, h]) => h);
    const flashObs = [];
    for (let fi = 0; fi < hist.length; fi++) {
      const h = hist[fi];
      if (h.length >= 2 && h[0].text !== h[h.length - 1].text && h[0].text.length < h[h.length - 1].text.length) {
        flashObs.push({ li: fi, dur: h[1].t - h[0].t, planned: planned[fi] || 0, from: h[0].text, to: h[h.length - 1].text });
      }
    }
    check('至少一行「先閃短句、再定稿」', flashObs.length >= 1,
      flashObs.length ? flashObs.map((o) => o.from + ' → ' + o.to).join(' ／ ') : '沒抓到閃字');
    const plannedFlashes = planned.filter((v) => v > 0);
    check('閃字規劃停留 200–400ms',
      plannedFlashes.length >= 1 && plannedFlashes.every((v) => v >= 200 && v <= 400),
      plannedFlashes.join(' / ') + 'ms');
    check('閃字不早於規劃就換掉（無頭環境長任務允許延後 ≤900ms）',
      flashObs.length >= 1 && flashObs.every((o) => o.dur >= Math.max(120, o.planned - 80) && o.dur <= o.planned + 900),
      flashObs.map((o) => o.dur + 'ms（規劃 ' + o.planned + '）').join(' / '));
    /* 逐行：用「第 0、1、2… 行第一次出現的時間」算間隔（不要用時間排序，免得閃字的第二次記錄插進來） */
    const starts = hist.map((h) => h[0].t);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    const lineDbg = histEntries.map(([i, h]) => i + ':' + h.map((e) => e.text.slice(0, 5) + '@' + e.t).join('>')).join(' | ');
    check('逐行間隔（排程 300–700ms；無頭環境抖動容許 200–1100ms）',
      gaps.length >= 1 && gaps.every((g) => g >= 200 && g <= 1100),
      gaps.map((g) => g + 'ms').join(' / ') + '　' + lineDbg);

    /* 段落 data-pi 沒被動到（第一章那一段） */
    const piNow = await page.evaluate(() => {
      const pb = document.querySelector('#stream .pb');
      return pb ? Array.from(pb.querySelectorAll('.p')).map((p) => p.dataset.pi) : [];
    });
    check('段落 data-pi 索引沒變', fmt(piNow) === fmt(beforeAdd.pi), fmt(beforeAdd.pi) + ' → ' + fmt(piNow));
  }

  /* ── 頂欄重疊（Lead 指定）：捲到最頂時，每個 .think 的 top ≥ #stream top、與 .topbar 0 重疊 ──
     註：捲動中的內容本來就可能捲到 #stream 上緣之外（被 overflow 裁掉），
     所以用「與 #stream 可視區的交集」算可見重疊面積；另外在捲動狀態也量一次。 */
  const measureOverlap = (scrollTo) => page.evaluate((top) => {
    const s = document.querySelector('#stream');
    if (typeof top === 'number') s.scrollTop = top;
    const sr = s.getBoundingClientRect();
    const tr = document.querySelector('.topbar').getBoundingClientRect();
    const inter = (a, b) => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return w > 0 && h > 0 ? Math.round(w * h) : 0;
    };
    const blocks = Array.from(document.querySelectorAll('#stream .think')).map((rz) => {
      const r = rz.getBoundingClientRect();
      const vis = {
        left: Math.max(r.left, sr.left), right: Math.min(r.right, sr.right),
        top: Math.max(r.top, sr.top), bottom: Math.min(r.bottom, sr.bottom),
      };
      return {
        top: Math.round(r.top), h: Math.round(r.height),
        rawTopOk: r.top >= sr.top - 1,
        rawOverlap: inter(r, tr),
        visibleOverlap: inter(vis, tr),
      };
    });
    return {
      streamTop: Math.round(sr.top), streamBottom: Math.round(sr.bottom),
      topbarTop: Math.round(tr.top), topbarBottom: Math.round(tr.bottom),
      scrollTop: Math.round(s.scrollTop),
      count: blocks.length,
      minTop: blocks.length ? Math.min.apply(null, blocks.map((b) => b.top)) : null,
      rawBad: blocks.filter((b) => !b.rawTopOk).length,
      visibleBad: blocks.filter((b) => b.visibleOverlap !== 0).length,
      blocks,
    };
  }, scrollTo);

  const ovScrolled = await measureOverlap();       // 先量現在的捲動狀態
  const overlapCheck = await measureOverlap(0);     // 再捲到最頂量
  check('思考塊不會壓到頂欄（捲到最頂：每個 .think top ≥ #stream top、與 .topbar 0 重疊）',
    overlapCheck.count > 0 && overlapCheck.streamTop >= overlapCheck.topbarBottom - 1
      && overlapCheck.blocks.every((b) => b.rawTopOk && b.rawOverlap === 0 && b.visibleOverlap === 0),
    `stream ${overlapCheck.streamTop}–${overlapCheck.streamBottom}、topbar ${overlapCheck.topbarTop}–${overlapCheck.topbarBottom}、`
      + `${overlapCheck.count} 塊 minTop=${overlapCheck.minTop}、頂欄外 ${overlapCheck.rawBad} 塊`);
  check('捲動中：思考塊的可見部分也不與頂欄重疊（被 #stream 裁掉的不算）',
    ovScrolled.count > 0 && ovScrolled.visibleBad === 0,
    `scrollTop=${ovScrolled.scrollTop}、${ovScrolled.count} 塊、可見重疊 ${ovScrolled.visibleBad} 塊`
      + `（raw top 在 stream 上緣外的有 ${ovScrolled.rawBad} 塊，那是捲出去被裁掉，不是壓到頂欄）`);

  /* ── ⑧ prefers-reduced-motion ── */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const mq = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  check('prefers-reduced-motion 模擬生效', mq === true);

  const beforeRm = await page.evaluate(() => ({
    ids: Array.from(document.querySelectorAll('#stream .think')).map((r) => r.dataset.tid),
  }));
  await page.evaluate(() => {
    const D = window.__moyuDebug;
    const i = Math.min(D.state.index + 1, D.state.chapters.length - 1);
    D.goChapter(i, { autoAppend: true }).catch(() => {});
  });
  const rm = await poll(async (ids) => page.evaluate((seen) => {
    const rzs = Array.from(document.querySelectorAll('#stream .think')).filter((r) => seen.indexOf(r.dataset.tid) < 0);
    if (!rzs.length) return null;
    const rz = rzs[rzs.length - 1];
    const lines = Array.from(rz.querySelectorAll('.think-l'));
    /* 文字／shimmer 的量測挑「思考句」（操作行是 .think-op，天生比較淡、不 shimmer） */
    const thoughtLine = lines.find((l) => !l.classList.contains('think-op')) || lines[0] || null;
    const tx = thoughtLine ? thoughtLine.querySelector('.think-tx') : null;
    const spin = rz.querySelector('.think-spin');
    const car = rz.querySelector('.think-car');
    return {
      id: rz.dataset.tid,
      state: rz.dataset.state,
      lines: lines.length,
      texts: lines.map((l) => l.querySelector('.think-tx').textContent),
      lineAnim: thoughtLine ? getComputedStyle(thoughtLine).animationName : '',
      lineOpacity: thoughtLine ? getComputedStyle(thoughtLine).opacity : '',
      txAnim: tx ? getComputedStyle(tx).animationName : '',
      txFill: tx ? getComputedStyle(tx).webkitTextFillColor : '',
      spinAnim: spin ? getComputedStyle(spin).animationName : '',
      carDur: car ? getComputedStyle(car).transitionDuration : '',
      carProp: car ? getComputedStyle(car).transitionProperty : '',
      scrollTop: document.querySelector('#stream').scrollTop,
    };
  }, ids), beforeRm.ids, 12000, 60);
  check('減少動態：一塊照樣出現', !!rm, rm ? rm.lines + ' 行、state=' + rm.state : '12s 內沒出現');
  if (rm) {
    check('減少動態：行直接全部顯示（不逐行）',
      rm.lines >= 2 && rm.lines <= 5 && rm.texts.every((t) => t && t.length > 0) && rm.lineOpacity === '1',
      fmt({ lines: rm.lines, opacity: rm.lineOpacity }));
    check('減少動態：沒有 animation／transition',
      rm.lineAnim === 'none' && rm.txAnim === 'none' && rm.spinAnim === 'none'
        && rm.carProp === 'none' && !(parseFloat(rm.carDur) > 0.001),
      fmt({ line: rm.lineAnim, tx: rm.txAnim, spin: rm.spinAnim, carDur: rm.carDur, carProp: rm.carProp }));
    check('減少動態：字沒有被 shimmer 吃掉（fill 不是透明）',
      !/transparent|rgba\(0, 0, 0, 0\)/.test(rm.txFill || ''), rm.txFill);
    const log2 = await page.evaluate(() => window.__rzLog);
    const rmHist = new Map();
    for (const e of log2) {
      if (e.id !== rm.id) continue;
      if (!rmHist.has(e.i)) rmHist.set(e.i, []);
      const h = rmHist.get(e.i);
      if (!h.length || h[h.length - 1].text !== e.text) h.push({ text: e.text, t: e.t });
    }
    check('減少動態：不閃字（每行只有一個版本）',
      Array.from(rmHist.values()).every((h) => h.length === 1),
      Array.from(rmHist.values()).map((h) => h.length).join(','));

    const rmDone = await poll(async (id) => page.evaluate((rid) => {
      const rz = document.querySelector('.think[data-tid="' + rid + '"]');
      if (!rz || rz.dataset.state !== 'done') return null;
      return { label: rz.querySelector('.think-t').textContent, sec: rz.querySelector('.think-sec').textContent };
    }, id), rm.id, 8000, 150);
    check('減少動態：照樣會完成（已完成思考）',
      !!rmDone && rmDone.label === '已完成思考' && /^\d+\.\d+s$/.test(rmDone.sec),
      rmDone ? rmDone.label + ' ' + rmDone.sec : '8s 內沒完成');
  }
  await page.emulateMediaFeatures([]);
  const mqOff = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  check('取消 prefers-reduced-motion 後恢復正常', mqOff === false);

  /* ── ⑨ 重掃不重複插 ── */
  const dup = await page.evaluate(() => {
    const c0 = window.__moyuReasoning.count();
    window.__moyuReasoning.scan();
    window.__moyuReasoning.scan();
    window.__moyuReasoning.scan();
    const c1 = window.__moyuReasoning.count();
    const turns = Array.from(document.querySelectorAll('#stream .turn.ai')).filter((t) => t.querySelector('.pb'));
    const perTurn = turns.map((t) => t.querySelectorAll(':scope > .b > .think').length);
    return { c0, c1, turns: turns.length, extra: perTurn.filter((n) => n > 1).length };
  });
  check('重掃不重複插入', dup.c0 === dup.c1 && dup.c1 <= dup.turns && dup.c1 >= 1 && dup.extra === 0,
    `.think ${dup.c0} → ${dup.c1}、助手回覆 ${dup.turns}、重複 ${dup.extra}`);

  /* ── 截圖（測試端自己捲，不是元件在捲）──
     全頁一張，再用 sharp 把推理塊裁出來放大 2 倍（12px 文字在全頁圖太小）。
     sharp 不在本專案依賴裡，沿用在 D:\kun-workspace\node_modules 的那份。 */
  const shots = [];
  const sharp = (() => { try { return require('D:/kun-workspace/node_modules/sharp'); } catch (e) { return null; } })();

  async function blockClip(id) {
    return page.evaluate((rid) => {
      const rz = document.querySelector('.think[data-tid="' + rid + '"]');
      if (!rz) return null;
      const b = rz.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    }, id);
  }

  async function cropFrom(p, name, clip, extraBottom) {
    if (!clip || !sharp) return;
    const left = Math.max(0, Math.round(clip.x - 18));
    const top = Math.max(0, Math.round(clip.y - 14));
    const width = Math.min(1440 - left, Math.max(40, Math.round(clip.w + 36)));
    const height = Math.min(900 - top, Math.max(20, Math.round(clip.h + 28 + (extraBottom || 0))));
    const out = path.join(OUT, 'reasoning-' + name + '-crop.png');
    try {
      await sharp(p).extract({ left, top, width, height }).resize({ width: width * 2 }).toFile(out);
      shots.push(out);
    } catch (e) {
      console.log('   [warn] 裁圖失敗 ' + name + '：' + e.message);
    }
  }

  async function shot(name, id, extraBottom) {
    const clip = id ? await blockClip(id) : null;
    const p = path.join(OUT, 'reasoning-' + name + '.png');
    try {
      await page.screenshot({ path: p, captureBeyondViewport: false });
      shots.push(p);
    } catch (e) {
      console.log('   [warn] 截圖失敗 ' + name + '：' + e.message);
      return;
    }
    await cropFrom(p, name, clip, extraBottom);
  }

  /* 無頭視窗的 page.screenshot 會等合成器出幀，常常慢 2–3 秒，抓到的已經是「已完成」那一幀。
     進行中的畫面改用 Page.startScreencast：一成形就送，拿到的是當時真的在跑的畫面。 */
  async function screencastShot(p, ms) {
    let client = null;
    let last = null;
    try {
      client = await page.createCDPSession();
      client.on('Page.screencastFrame', async (ev) => {
        last = ev.data;
        try { await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch (e) {}
      });
      await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 1440, maxHeight: 900 });
      await sleep(ms);
      try { await client.send('Page.stopScreencast'); } catch (e) {}
      await client.detach().catch(() => {});
    } catch (e) {
      console.log('   [warn] screencast 失敗：' + e.message);
    }
    if (!last) return false;
    fs.writeFileSync(p, Buffer.from(last, 'base64'));
    return true;
  }

  const beforeShot = await page.evaluate(() => ({
    ids: Array.from(document.querySelectorAll('#stream .think')).map((r) => r.dataset.tid),
  }));
  await page.evaluate(() => {
    const D = window.__moyuDebug;
    const i = Math.min(D.state.index + 1, D.state.chapters.length - 1);
    D.goChapter(i, { autoAppend: true }).catch(() => {});
  });
  const shotBlock = await poll(async (ids) => page.evaluate((seen) => {
    const rzs = Array.from(document.querySelectorAll('#stream .think')).filter((r) => seen.indexOf(r.dataset.tid) < 0);
    if (!rzs.length) return null;
    const rz = rzs[rzs.length - 1];
    rz.scrollIntoView({ block: 'center' });
    const r = rz.getBoundingClientRect();
    const stream = document.querySelector('#stream');
    return {
      id: rz.dataset.tid, state: rz.dataset.state,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      scrollTop: stream.scrollTop, clientH: stream.clientHeight, scrollH: stream.scrollHeight,
      text: rz.innerText.replace(/\s+/g, ' ').slice(0, 160),
    };
  }, ids), beforeShot.ids, 12000, 60);
  let shotDbg = null;
  if (shotBlock) {
    shotDbg = await page.evaluate((id) => {
      const rz = document.querySelector('.think[data-tid="' + id + '"]');
      if (!rz) return { missing: true };
      const r = rz.getBoundingClientRect();
      const stream = document.querySelector('#stream');
      const body = rz.querySelector('.think-body');
      return {
        state: rz.dataset.state,
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        scrollTop: stream.scrollTop, clientH: stream.clientHeight, scrollH: stream.scrollHeight,
        text: rz.innerText.replace(/\s+/g, ' ').slice(0, 160),
        bodyH: body ? body.offsetHeight : -1,
        open: rz.dataset.open,
        header: rz.querySelector('.think-h').textContent.replace(/\s+/g, ' ').trim(),
      };
    }, shotBlock.id);
    const st = shotDbg && shotDbg.state ? shotDbg.state : '';
    const runName = st === 'done' ? 'run2' : 'run';
    const runPath = path.join(OUT, 'reasoning-' + runName + '.png');
    const runClip = await blockClip(shotBlock.id);
    const gotRun = st !== 'done' ? await screencastShot(runPath, 1200) : false;
    if (gotRun) {
      shots.push(runPath);
      await cropFrom(runPath, runName, runClip, 70);
    } else {
      await shot(runName, shotBlock.id, 70);
    }
  } else {
    await shot('run');
  }
  if (shotDbg) console.log('   [debug] 截圖時 block：' + JSON.stringify(shotDbg));
  // 等它完成、展開截圖
  if (shotBlock) {
    await poll(async (id) => page.evaluate((rid) => {
      const rz = document.querySelector('.think[data-tid="' + rid + '"]');
      return rz && rz.dataset.state === 'done' ? true : null;
    }, id), shotBlock.id, 8000, 150);
    await page.evaluate((id) => {
      const rz = document.querySelector('.think[data-tid="' + id + '"]');
      if (!rz) return;
      if (rz.dataset.open !== '1') rz.querySelector('.think-h').click();
      rz.scrollIntoView({ block: 'center' });
    }, shotBlock.id);
    await sleep(300);
    await shot('open', shotBlock.id);
    await page.evaluate((id) => {
      const rz = document.querySelector('.think[data-tid="' + id + '"]');
      if (rz && rz.dataset.open === '1') rz.querySelector('.think-h').click();
      if (rz) rz.scrollIntoView({ block: 'center' });
    }, shotBlock.id);
    await sleep(250);
    await shot('done', shotBlock.id);

    // 淺色主題
    await page.evaluate(() => window.__moyuDebug.setTheme('dsh-light'));
    await page.evaluate((id) => {
      const rz = document.querySelector('.think[data-tid="' + id + '"]');
      if (rz && rz.dataset.open !== '1') rz.querySelector('.think-h').click();
      if (rz) rz.scrollIntoView({ block: 'center' });
    }, shotBlock.id);
    await sleep(400);
    await shot('light', shotBlock.id);
    await page.evaluate(() => window.__moyuDebug.setTheme('dsh'));
  }

  /* ── ⑩ 錯誤 ── */
  await sleep(500);
  check('沒有 pageerror', errors.filter((e) => e.indexOf('pageerror:') === 0).length === 0,
    errors.filter((e) => e.indexOf('pageerror:') === 0).join(' | '));
  check('沒有 console error', errors.filter((e) => e.indexOf('console:') === 0).length === 0,
    errors.filter((e) => e.indexOf('console:') === 0).slice(0, 3).join(' | '));

  const passed = results.filter((r) => r.pass).length;
  const report = {
    generatedAt: new Date().toISOString(),
    injected,
    passed,
    total: results.length,
    screenshots: shots,
    shotDebug: shotDbg,
    errors,
    results,
  };
  fs.writeFileSync(path.join(OUT, 'reasoning.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('\n' + (passed === results.length ? '✅' : '❌') + ` ${passed}/${results.length} 通過`);
  console.log('結果：_probe/reasoning.json');
  if (shots.length) console.log('截圖：' + shots.map((s) => path.relative(ROOT, s)).join('、'));

  try { browser.disconnect(); } catch (e) {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
})();
