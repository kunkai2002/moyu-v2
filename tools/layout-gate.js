/* 幾何閘門（layout gate）
   ─────────────────────────────────────────────────────────────
   魔芋一夏的 DSH 外殼是「復刻」不是「設計」：
   每個數字都必須等於 docs/DSH-真值.json（tools/dsh-truth.js 從 E:\DeepSeek\resources\app.asar 抽的），
   渲染出來的 box 誤差 > ±2px 就紅燈、exit 1。

   為什麼要閘門：CSS 改一行就歪 4px，眼睛看不出來；真值離開眼睛 3 小時就忘了。
   為什麼要 --selftest：量測引擎（Electron + puppeteer + getBoundingClientRect + computedStyle）
   自己如果有誤差，上面的 ±2px 全是假的。selftest 在合成頁量已知尺寸，誤差必須 0，才准報真實結果。

   用法：
     node tools/layout-gate.js                    # 量 ui/ 真實渲染（無頭 Electron）
     node tools/layout-gate.js --selftest         # 只驗量測引擎（合成頁，容差 0）
     node tools/layout-gate.js --port=9357        # 換偵錯埠
     node tools/layout-gate.js --shell=dsh --theme=dsh-light
     node tools/layout-gate.js --theme=boot   # 不覆寫主題，量應用程式預設外觀
     node tools/layout-gate.js --tol=2        # 容差（預設 ±2px）
   報告：
     _probe/layout-gate.json            （真實量測）
     _probe/layout-gate-selftest.json   （引擎自檢）

   邊界：本工具只讀 ui/、docs/DSH-真值.json，不改任何 ui 檔。
*/
'use strict';

const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const appEnv = require('./app-env');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const TRUTH_FILE = path.join(ROOT, 'docs', 'DSH-真值.json');
const TOKEN_FILE = path.join(ROOT, 'ui', 'dsh-tokens.css');
const THEME_FILE = path.join(ROOT, 'ui', 'theme.css');
const PROBE_DIR = path.join(ROOT, '_probe', 'layout-data');
const REPORT_FILE = path.join(ROOT, '_probe', 'layout-gate.json');
const SELFTEST_REPORT = path.join(ROOT, '_probe', 'layout-gate-selftest.json');
const SELFTEST_PAGE = path.join(ROOT, '_probe', 'layout-selftest.html');
const DEFAULT_PORT = 9357;
const DEFAULT_TOL = 2;

const ARGV = process.argv.slice(2);
const hasFlag = (n) => ARGV.some((a) => a === '--' + n);
const opt = (n, d) => {
  const hit = ARGV.find((a) => a.startsWith('--' + n + '='));
  return hit ? hit.slice(n.length + 3) : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => (n == null || Number.isNaN(n)) ? '—'
  : (Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(2));
const signed = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + fmt(n));

/* 中文字寬 2：表格才對得齊 */
const widthOf = (s) => {
  let w = 0;
  for (const ch of String(s)) {
    w += /[\u1100-\u115F\u2600-\u27BF\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1;
  }
  return w;
};
const pad = (s, n) => {
  s = String(s);
  let w = widthOf(s);
  let out = s;
  while (w < n) { out += ' '; w++; }
  return out;
};

function parseNum(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^(normal|auto|none|inherit|initial|unset)$/.test(s)) return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/* "10px 28px 0 20px" → {top,right,bottom,left} */
function parseBox(v) {
  const parts = String(v || '').trim().split(/\s+/).map(parseNum);
  if (!parts.length || parts.some((x) => x == null)) return null;
  const [a, b = a, c = a, d = b] = parts;
  return { top: a, right: b, bottom: c, left: d };
}

/* ──────────────────────────────────────────────────────────────
   在頁面裡量：這個函式會被 puppeteer 序列化送進 renderer，
   selftest 與真實量測走的是「同一個」量測路徑（所以引擎誤差 0 才有意義）。
   ────────────────────────────────────────────────────────────── */
function measureInPage(items) {
  const out = [];
  for (const it of items) {
    const r = { id: it.id, found: false, injected: false, rect: null, computed: {}, error: null };
    let node = null;
    try {
      node = document.querySelector(it.selector);
    } catch (e) {
      r.error = 'BAD_SELECTOR';
      out.push(r);
      continue;
    }
    if (!node && it.inject) {
      const host = document.querySelector(it.inject.into);
      if (host) {
        const n = document.createElement(it.inject.tag || 'div');
        if (it.inject.cls) n.className = it.inject.cls;
        n.innerHTML = it.inject.html || 'x';
        host.appendChild(n);
        node = n;
        r.injected = true;
      } else {
        r.error = 'HOST_MISSING';
      }
    }
    if (!node) {
      if (!r.error) r.error = 'SELECTOR_MISSING';
      out.push(r);
      continue;
    }
    const rect = node.getBoundingClientRect();
    r.rect = { width: round4(rect.width), height: round4(rect.height), top: round4(rect.top), left: round4(rect.left) };
    if (it.computed && it.computed.length) {
      const cs = getComputedStyle(node);
      for (const p of it.computed) r.computed[p] = cs.getPropertyValue(p);
    }
    r.found = true;
    out.push(r);
  }
  return out;

  function round4(n) { return Math.round(n * 10000) / 10000; }
}

/* ──────────────────────────────────────────────────────────────
   真值 → 檢查清單
   ────────────────────────────────────────────────────────────── */
function buildRealSpec(truth) {
  const g = truth.geometry;
  const t = g.tokens;
  const items = [];
  const add = (o) => { items.push(o); return o; };

  add({
    id: 'sidebar-width', label: '側欄寬', selector: '.side', metric: 'rect',
    expect: { width: g.frame.sidebarWidth.value }, src: g.frame.sidebarWidth.src,
    note: 'data-shell=dsh',
  });
  add({
    id: 'side-brand-height', label: '側欄品牌列高', selector: '.side-brand', metric: 'rect',
    expect: { height: g.sidebar.logoRowHeight.value }, src: g.sidebar.logoRowHeight.src,
  });
  add({
    id: 'new-session-height', label: '新對話鈕高', selector: '#saNew', metric: 'rect',
    expect: { height: g.sidebar.newSessionHeight.value }, src: g.sidebar.newSessionHeight.src,
  });
  add({
    id: 'panel-row-height', label: '面板列高', selector: '.side-actions .sa', metric: 'rect',
    expect: { height: g.sidebar.panelRowMinHeight.value }, src: g.sidebar.panelRowMinHeight.src,
  });
  add({
    id: 'list-row-height', label: '清單列高', selector: '.tree .ch', metric: 'rect',
    expect: { height: g.sidebar.panelRowMinHeight.value }, src: g.sidebar.panelRowMinHeight.src,
    note: '清單列沿用側欄 panelRow 列高',
    inject: { into: '.tree', tag: 'button', cls: 'ch', html: '<span class="no">1</span><span class="nm">樣本列</span>' },
  });
  add({
    id: 'icon-button-size', label: '圖示鈕 28×28', selector: '.ghost.icon, .icon-button', metric: 'rect',
    expect: { width: g.sidebar.iconButtonSize.value, height: g.sidebar.iconButtonSize.value },
    src: g.sidebar.iconButtonSize.src,
  });

  add({
    id: 'topbar-min-height', label: '頂欄 min-height', selector: '.topbar', metric: 'computed',
    expect: { 'min-height': g.header.minHeight.value }, computed: ['min-height'],
    src: g.header.minHeight.src,
  });
  add({
    id: 'topbar-height', label: '頂欄實際高', selector: '.topbar', metric: 'rect',
    expect: { height: g.header.minHeight.value }, src: g.header.minHeight.src,
    note: 'min-height 的落地驗證',
  });
  const pb = parseBox(g.header.padding.value);
  if (pb) {
    add({
      id: 'topbar-padding', label: '頂欄 padding', selector: '.topbar', metric: 'computed',
      expect: { 'padding-top': pb.top, 'padding-right': pb.right, 'padding-bottom': pb.bottom, 'padding-left': pb.left },
      computed: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
      src: g.header.padding.src,
    });
  }
  add({
    id: 'composer-radius', label: '輸入卡片圓角', selector: '.composer .box', metric: 'computed',
    expect: { 'border-top-left-radius': t.radius.panel.value, 'border-bottom-right-radius': t.radius.panel.value },
    computed: ['border-top-left-radius', 'border-bottom-right-radius'],
    src: 'dsh-client-ui-conversation :: .GRgSLq_card（var(--dsw-radius-panel) = ' + t.radius.panel.value + '）',
  });
  add({
    id: 'input-min-height', label: '輸入框 min-height', selector: '#input', metric: 'computed',
    expect: { 'min-height': g.composer.inputMinHeight.value }, computed: ['min-height'],
    src: g.composer.inputMinHeight.src,
  });
  add({
    id: 'text-metrics', label: '正文 14px／24px', selector: '.p', metric: 'computed',
    expect: {
      'font-size': parseNum(t.font.contentSize.value),
      'line-height': t.font.markdownBaseLineHeight.value,
    },
    computed: ['font-size', 'line-height'],
    src: 'dsh-client-ui-theme :: --dsw-font-markdown-base 14px / 24px',
    inject: { into: '#stream', tag: 'div', cls: 'p', html: '樣本段落 Sample paragraph' },
  });

  return items;
}

function buildTokenSpec(truth) {
  const r = truth.geometry.tokens.radius;
  return ['sm', 'md', 'lg', 'xl', 'panel'].map((k) => ({
    id: 'token-radius-' + k,
    label: '圓角代幣 --dsh-radius-' + k,
    token: '--dsh-radius-' + k,
    alt: '--dsw-radius-' + k,
    expect: r[k] ? r[k].value : null,
    src: r[k] ? r[k].src : '',
  }));
}

/* ──────────────────────────────────────────────────────────────
   讀 CSS 代幣（偶爾 Lead 會把代幣放 theme.css，兩邊都找）
   ────────────────────────────────────────────────────────────── */
function loadTokens() {
  const map = {};
  for (const file of [TOKEN_FILE, THEME_FILE]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const re = /(--[a-zA-Z0-9-]+)\s*:\s*([^;{}]+);/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1];
      const value = m[2].trim();
      if (!map[name]) map[name] = { file: path.relative(ROOT, file).replace(/\\/g, '/'), values: [value] };
      else map[name].values.push(value);
    }
  }
  return map;
}

/* ──────────────────────────────────────────────────────────────
   比對
   ────────────────────────────────────────────────────────────── */
function evaluateItem(item, res, tol) {
  const out = {
    id: item.id, label: item.label, selector: item.selector, metric: item.metric,
    src: item.src || '', found: !!(res && res.found), injected: !!(res && res.injected),
    pass: false, checks: [], rect: res ? res.rect : null,
    computedRaw: res ? res.computed : null,
  };
  if (!out.found) {
    out.error = (res && res.error) || 'SELECTOR_MISSING';
    out.note = out.error === 'HOST_MISSING'
      ? '選擇器不存在（連注入用的容器也不存在）'
      : '選擇器不存在';
    return out;
  }
  let ok = true;
  for (const key of Object.keys(item.expect)) {
    const exp = item.expect[key];
    const raw = item.metric === 'rect' ? (res.rect ? res.rect[key] : null) : (res.computed ? res.computed[key] : null);
    const actual = item.metric === 'rect' ? raw : parseNum(raw);
    const diff = (actual == null) ? null : round2(actual - exp);
    const good = actual != null && Math.abs(diff) <= tol;
    out.checks.push({ key, expect: exp, actual, diff, raw: raw == null ? null : String(raw), pass: good });
    if (!good) ok = false;
  }
  out.pass = ok;
  return out;
}

function evaluateTokenItem(item, tokens, tol) {
  const name = item.token;
  const alt = item.alt;
  const hit = tokens[name] || (alt ? tokens[alt] : null);
  const usedName = tokens[name] ? name : (alt && tokens[alt] ? alt : name);
  const out = {
    id: item.id, label: item.label, metric: 'token', src: item.src || '',
    selector: hit ? hit.file + ' :: ' + usedName : 'ui/dsh-tokens.css :: ' + name,
    found: !!hit, pass: false, checks: [],
  };
  if (!hit) {
    out.error = 'TOKEN_MISSING';
    out.note = '代幣不存在（找過 --dsh-radius-* 與 --dsw-radius-*）';
    return out;
  }
  const numeric = hit.values.map(parseNum).filter((x) => x != null);
  const actual = numeric.length ? numeric[0] : null;
  const diff = (actual == null || item.expect == null) ? null : round2(actual - item.expect);
  const good = actual != null && item.expect != null
    && Math.abs(diff) <= tol && numeric.every((x) => Math.abs(x - item.expect) <= tol);
  out.checks.push({ key: usedName, expect: item.expect, actual, diff, raw: hit.values.join(' | '), pass: good });
  out.pass = good;
  const distinct = [...new Set(hit.values)];
  if (distinct.length > 1) out.note = '同一代幣多次定義：' + distinct.join(' / ');
  return out;
}

/* ──────────────────────────────────────────────────────────────
   啟動無頭 Electron（照 audit-chat-ui.js 的連法，但載入本專案 ui/）
   ────────────────────────────────────────────────────────────── */
function killTree(pid) {
  if (!pid) return;
  try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
}

async function freePort(start) {
  for (let p = start; p < start + 40; p++) {
    const ok = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(p, '127.0.0.1');
    });
    if (ok) return p;
  }
  return start;
}

async function launch() {
  if (!fs.existsSync(EXE)) throw new Error('找不到 Electron：' + EXE + '（先在專案根目錄 npm i）');
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROBE_DIR, 'window.json'),
    JSON.stringify({ width: 1440, height: 900, x: 80, y: 60, maximized: false }), 'utf8');

  const port = await freePort(Number(opt('port', DEFAULT_PORT)));
  const child = spawn(EXE,
    [ROOT, '--data-dir=' + PROBE_DIR, '--hidden', '--remote-debugging-port=' + port],
    { stdio: 'ignore', env: appEnv() });

  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(300);
    try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + port, defaultViewport: null }); } catch (e) {}
  }
  if (!browser) {
    killTree(child.pid);
    throw new Error('連不上偵錯埠 ' + port + '（Electron 沒起來？）');
  }

  let page = null;
  for (let i = 0; i < 50 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    page = pages.find((p) => p.url().startsWith('file:') && /index\.html/.test(p.url()))
      || pages.find((p) => p.url().startsWith('file:'))
      || pages[0];
    if (!page) await sleep(200);
  }
  if (!page) {
    try { browser.disconnect(); } catch (e) {}
    killTree(child.pid);
    throw new Error('找不到應用頁面（ui/index.html 沒載入？）');
  }
  return { child, browser, page, port };
}

/* ──────────────────────────────────────────────────────────────
   輸出
   ────────────────────────────────────────────────────────────── */
function checkSummary(it) {
  return it.checks.map((c) => fmt(c.expect)).join('/');
}
function checkActual(it) {
  return it.checks.map((c) => (c.actual == null ? '—' : fmt(c.actual))).join('/');
}
function checkDiff(it) {
  return it.checks.map((c) => signed(c.diff)).join('/');
}

function printTable(items, title, subtitle) {
  console.log('\n════ ' + title + ' ════');
  for (const s of subtitle) console.log('  ' + s);
  console.log('');
  for (const it of items) {
    const mark = it.pass ? '✅' : '❌';
    const tag = it.injected ? '（注入樣本）' : '';
    if (!it.found) {
      console.log(mark + ' ' + pad(it.label, 20) + pad('—', 10) + pad('—', 10) + pad(it.note || '不存在', 18) + it.selector);
      continue;
    }
    console.log(mark + ' ' + pad(it.label + tag, 20)
      + ' 真值 ' + pad(checkSummary(it), 12)
      + ' 實測 ' + pad(checkActual(it), 12)
      + ' 差 ' + pad(checkDiff(it), 10)
      + shortSrc(it.src));
  }
  console.log('');
}

function shortSrc(src) {
  if (!src) return '';
  const i = String(src).indexOf(' :: ');
  return i >= 0 ? String(src).slice(i + 4) : String(src);
}

function printFailures(items) {
  const bad = items.filter((x) => !x.pass);
  if (!bad.length) return;
  console.log('❌ ' + bad.length + ' 項不合格（共 ' + items.length + ' 項）');
  for (const it of bad) {
    const why = !it.found ? (it.note || '選擇器不存在') : it.checks.filter((c) => !c.pass)
      .map((c) => c.key + ' 真值 ' + fmt(c.expect) + '／實測 ' + (c.actual == null ? '—' : fmt(c.actual)) + '（' + signed(c.diff) + '）').join('；');
    console.log('   · ' + it.label + '：' + why + (it.selector ? '  [' + it.selector + ']' : ''));
  }
  console.log('');
}

function writeReport(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  console.log('報告：' + path.relative(ROOT, file).replace(/\\/g, '/'));
}

/* ──────────────────────────────────────────────────────────────
   合成頁：量已知尺寸，證明量測引擎誤差 0
   ────────────────────────────────────────────────────────────── */
const SELFTEST_ITEMS = [
  { id: 'st-width', label: '寬 280', selector: '#w', metric: 'rect', expect: { width: 280 } },
  { id: 'st-height', label: '高 76', selector: '#w', metric: 'rect', expect: { height: 76 } },
  { id: 'st-brand', label: '品牌列高 60', selector: '#brand', metric: 'rect', expect: { height: 60 } },
  { id: 'st-icon', label: '圖示鈕 28×28', selector: '#icon', metric: 'rect', expect: { width: 28, height: 28 } },
  {
    id: 'st-radius', label: '圓角 28', selector: '#card', metric: 'computed',
    expect: { 'border-top-left-radius': 28, 'border-bottom-right-radius': 28 },
    computed: ['border-top-left-radius', 'border-bottom-right-radius'],
  },
  { id: 'st-min-height', label: 'min-height 36', selector: '#card', metric: 'computed', expect: { 'min-height': 36 }, computed: ['min-height'] },
  {
    id: 'st-padding', label: 'padding 10/28/0/20', selector: '#card', metric: 'computed',
    expect: { 'padding-top': 10, 'padding-right': 28, 'padding-bottom': 0, 'padding-left': 20 },
    computed: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  },
  {
    id: 'st-text', label: '字級 14／行高 24', selector: '#card', metric: 'computed',
    expect: { 'font-size': 14, 'line-height': 24 },
    computed: ['font-size', 'line-height'],
  },
];

function writeSelftestPage() {
  const html = '<!doctype html>\n'
    + '<html lang="zh-Hant"><head><meta charset="utf-8"><title>layout-gate selftest</title><style>\n'
    + '  html,body{margin:0;padding:0}\n'
    + '  #w{width:280px;height:76px;background:#222}\n'
    + '  #brand{width:280px;height:60px;background:#333}\n'
    + '  #icon{width:28px;height:28px;background:#444}\n'
    + '  #card{width:320px;min-height:36px;padding:10px 28px 0 20px;border-radius:28px;'
    + 'font-size:14px;line-height:24px;background:#eee}\n'
    + '</style></head><body>\n'
    + '  <div id="w"></div>\n'
    + '  <div id="brand"></div>\n'
    + '  <div id="icon"></div>\n'
    + '  <div id="card">樣本段落 Sample paragraph</div>\n'
    + '</body></html>\n';
  fs.mkdirSync(path.dirname(SELFTEST_PAGE), { recursive: true });
  fs.writeFileSync(SELFTEST_PAGE, html, 'utf8');
}

async function runSelftest() {
  writeSelftestPage();
  const { child, browser, page, port } = await launch();
  let items = [];
  try {
    const url = 'file:///' + SELFTEST_PAGE.replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await sleep(200);
    const raw = await page.evaluate(measureInPage, SELFTEST_ITEMS);
    items = SELFTEST_ITEMS.map((it, i) => evaluateItem(it, raw[i], 0));
  } finally {
    try { browser.disconnect(); } catch (e) {}
    killTree(child.pid);
  }

  const fails = items.filter((x) => !x.pass).length;
  let maxErr = 0;
  for (const it of items) for (const c of it.checks) if (c.diff != null) maxErr = Math.max(maxErr, Math.abs(c.diff));

  printTable(items, '量測引擎自檢（合成頁・容差 0）', [
    '頁面：_probe/layout-selftest.html（本工具自己產生的合成頁）',
    '偵錯埠：' + port + ' · 引擎：Electron + puppeteer-core + getBoundingClientRect / computedStyle',
    '量到的東西必須完全等於寫死的尺寸，誤差不是 0 就代表上面的 ±2px 不可信。',
  ]);

  if (fails === 0) {
    console.log('✅ 量測引擎誤差 0（' + items.length + ' 項全中）');
  } else {
    console.log('❌ 量測引擎有誤差：' + fails + ' 項不符，最大誤差 ' + fmt(maxErr) + 'px');
  }

  writeReport(SELFTEST_REPORT, {
    schema: 1,
    at: new Date().toISOString(),
    mode: 'selftest',
    ok: fails === 0,
    engineMaxErrorPx: round2(maxErr),
    page: '_probe/layout-selftest.html',
    summary: { total: items.length, pass: items.length - fails, fail: fails },
    items,
  });

  process.exit(fails === 0 ? 0 : 1);
}

/* ──────────────────────────────────────────────────────────────
   真實量測：ui/ 渲染 box vs DSH 真值
   ────────────────────────────────────────────────────────────── */
async function runGate(tol, shell, theme) {
  let truth;
  try {
    truth = JSON.parse(fs.readFileSync(TRUTH_FILE, 'utf8'));
  } catch (e) {
    console.error('❌ 讀不到真值檔 ' + path.relative(ROOT, TRUTH_FILE).replace(/\\/g, '/') + '：' + e.message);
    process.exit(2);
  }

  const spec = buildRealSpec(truth);
  const tokenSpec = buildTokenSpec(truth);
  const tokens = loadTokens();

  const { child, browser, page, port } = await launch();
  let pageInfo = {};
  let items = [];
  try {
    await page.waitForFunction(
      'document.readyState === "complete" && !!document.querySelector(".app")',
      { timeout: 15000 }).catch(() => {});
    await page.evaluate(({ sh, th }) => {
      const root = document.documentElement;
      // boot = 不覆寫，量應用程式自己開起來的樣子（用來對照預設主題）
      if (sh !== 'boot') root.setAttribute('data-shell', sh);
      if (th !== 'boot') root.setAttribute('data-theme', th);
    }, { sh: shell, th: theme });
    await sleep(600);

    pageInfo = await page.evaluate(() => ({
      w: innerWidth, h: innerHeight, dpr: devicePixelRatio, url: location.href,
      title: document.title,
      shell: document.documentElement.getAttribute('data-shell'),
      theme: document.documentElement.getAttribute('data-theme'),
    }));

    const raw = await page.evaluate(measureInPage, spec);
    items = spec.map((it, i) => evaluateItem(it, raw[i], tol));
    // 圓角代幣是寫死的常數，不是渲染出來的 box → 容差 0（8px 就是 8px）
    items = items.concat(tokenSpec.map((it) => evaluateTokenItem(it, tokens, 0)));
  } finally {
    try { browser.disconnect(); } catch (e) {}
    killTree(child.pid);
  }

  const fails = items.filter((x) => !x.pass).length;
  const missing = items.filter((x) => !x.found).length;

  printTable(items, '魔芋一夏 · 幾何閘門（DSH 真值 ±' + tol + 'px）', [
    '真值：docs/DSH-真值.json（抽出 ' + ((truth.meta && truth.meta.extractedAt) || '?') + '）',
    '環境：data-shell=' + shell + ' · data-theme=' + theme + ' · 視窗 ' + (pageInfo.w || '?') + '×' + (pageInfo.h || '?')
      + ' · DPR ' + (pageInfo.dpr || '?') + ' · 偵錯埠 ' + port,
    '用法：node tools/layout-gate.js --selftest（先證明量測引擎誤差 0）',
  ]);

  if (fails === 0) {
    console.log('✅ 幾何全部通過（' + items.length + ' 項，誤差 ≤ ±' + tol + 'px）');
  } else {
    printFailures(items);
    console.log('❌ ' + fails + ' 項不合格' + (missing ? '（其中 ' + missing + ' 項選擇器不存在）' : ''));
  }

  writeReport(REPORT_FILE, {
    schema: 1,
    at: new Date().toISOString(),
    mode: 'real',
    ok: fails === 0,
    tolerance: tol,
    truth: { file: 'docs/DSH-真值.json', extractedAt: truth.meta && truth.meta.extractedAt },
    env: {
      ui: 'ui/index.html',
      shell, theme,
      viewport: pageInfo,
      electron: path.relative(ROOT, EXE).replace(/\\/g, '/'),
      dataDir: '_probe/layout-data',
      port,
    },
    summary: { total: items.length, pass: items.length - fails, fail: fails, missing },
    items,
  });

  process.exit(fails === 0 ? 0 : 1);
}

/* ──────────────────────────────────────────────────────────────
   main
   ────────────────────────────────────────────────────────────── */
(async () => {
  const selftest = hasFlag('selftest');
  const tol = Number(opt('tol', selftest ? 0 : DEFAULT_TOL));
  const shell = opt('shell', 'dsh');
  const theme = opt('theme', 'dsh-light');
  try {
    if (selftest) await runSelftest();
    else await runGate(tol, shell, theme);
  } catch (e) {
    console.error('❌ 量測環境失敗：' + (e && e.message ? e.message : e));
    process.exit(2);
  }
})();
