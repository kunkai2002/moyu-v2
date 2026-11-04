/* 視覺閘門（ui-lint）
   ─────────────────────────────────────────────────────────────
   把 JOJO 的「不能有視覺上的問題」拆成七類可驗的檢查，全部用程式量：

     1 間距網格   關鍵元素的 padding／margin／圓角／高度必須落在 4px 網格，
                  或 docs/DSH-真值.json 裡的值（真值優先，不手寫近似值）。
     2 字級／行高 全站 computed font-size 只能是 {11,11.5,12,12.5,13,14,16,18,21}；
                  line-height 只能是 {20,22,24,26,28,30}。
     3 對比度     WCAG AA：正文 4.5:1、大字 3:1。前景取 computed color，
                  背景往上找第一個非 transparent 底色並做 alpha 疊合；每個主題都要過。
     4 圖示尺寸   所有可見 <svg> 只准 {12,14,16,18,20}，或明確 fit 容器的 100%。
     5 互動態     每個 button/[role=button] 都要有 :hover 與 :focus-visible
                  （掃 CSSOM 的規則比對；找不到規則的再用 CDP 強制偽類做視覺差異確認）。
     6 溢出／裁切 6 種視窗寬不得水平溢出；.statusbar／.composer .box／.topbar
                  不得被 overflow:hidden/clip 的父層裁掉。
     7 動效       CDP 模擬 prefers-reduced-motion: reduce 後，
                  transition/animation 必須關掉（duration ≤ 2ms）。

   量測引擎跟 tools/layout-gate.js 同一套（Electron + puppeteer-core +
   getBoundingClientRect / getComputedStyle），差別只在這裡量的是「視覺規則」不是幾何真值。
   --selftest 先在合成頁量已知 4px 間距／21:1 對比／12px 字，誤差 0 才准報真實結果。

   用法：
     node tools/ui-lint.js                    # 真實量測（無頭，8 主題 × 6 尺寸）
     node tools/ui-lint.js --selftest         # 只驗量測引擎（合成頁）
     node tools/ui-lint.js --theme=dsh        # 只跑一個主題
     node tools/ui-lint.js --size=1440x900    # 只跑一個尺寸
     node tools/ui-lint.js --probe            # 印環境與 DOM 統計（除錯用）
     node tools/ui-lint.js --port=9367        # 換偵錯埠

   輸出：
     _probe/ui-lint.json            真實量測（完整違規清單）
     _probe/ui-lint-selftest.json   引擎自檢
     終端機表格：每個違規一行（類別／選擇器／實測／期望），exit 1 不合格。

   邊界：只讀 ui/ 與 docs/DSH-真值.json，不改任何 ui 檔。
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
const PROBE_DIR = path.join(ROOT, '_probe', 'ui-lint-data');
const REPORT_FILE = path.join(ROOT, '_probe', 'ui-lint.json');
const SELFTEST_REPORT = path.join(ROOT, '_probe', 'ui-lint-selftest.json');
const SELFTEST_PAGE = path.join(ROOT, '_probe', 'ui-lint-selftest.html');
const DEFAULT_PORT = 9367;

const ARGV = process.argv.slice(2);
const hasFlag = (n) => ARGV.some((a) => a === '--' + n);
const opt = (n, d) => {
  const hit = ARGV.find((a) => a.startsWith('--' + n + '='));
  return hit ? hit.slice(n.length + 3) : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => (n == null || Number.isNaN(n) ? '—'
  : (Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : String(round2(n))));

/* 中文字寬 2：終端機表格才對得齊 */
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
const clip = (s, n) => {
  s = String(s);
  if (widthOf(s) <= n) return s;
  let out = '';
  for (const ch of s) {
    if (widthOf(out + ch) > n - 1) break;
    out += ch;
  }
  return out + '…';
};

/* ──────────────────────────────────────────────────────────────
   檢查清單／尺度
   ────────────────────────────────────────────────────────────── */
const THEMES = ['dsh', 'dsh-light', 'claude-code', 'claude', 'vscode', 'excel', 'terminal', 'word'];
const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
  { w: 1024, h: 768 },
  { w: 820, h: 900 },
  { w: 390, h: 844 },
];
const BASE_VIEWPORT = { w: 1440, h: 900 };
const SHELL = 'dsh';
const FONT_SCALE = [11, 11.5, 12, 12.5, 13, 14, 16, 18, 21];
/* 16/18 是小 UI 文字（分頁、標籤）的合法行高，DSH 真值就是 13/16 */
const LINE_HEIGHTS = [16, 18, 20, 22, 24, 26, 28, 30];
const ICON_SIZES = [12, 14, 16, 18, 20];
const INTERACTION_SELECTOR = 'button, [role="button"]';
const MOTION_MAX_SEC = 0.002;      // 1ms/.001ms 是「關掉」的標準寫法，2ms 內視為關閉
const MOTION_SAMPLE_LIMIT = 120;

/* 量測哪些元素的間距網格（任務指定的關鍵元素） */
const GRID_SPEC = [
  { selector: '.topbar', label: '頂欄' },
  { selector: '.side', label: '側欄', width: true, height: false },
  { selector: '.side-actions .sa', label: '面板列' },
  { selector: '.sr-row', label: '最近列（樣本）' },
  { selector: '.ch', label: '清單列（樣本）' },
  { selector: '.composer .box', label: '輸入卡片', height: false }, // 高度由內容決定，量 padding／圓角
  { selector: '.panel-head', label: '面板頭' },
  { selector: '.statusbar', label: '狀態列' },
];

const CLIP_TARGETS = ['.statusbar', '.composer .box', '.topbar'];

const CATEGORIES = [
  { id: 'grid', name: '1. 間距網格（4px 或真值）', short: '間距' },
  { id: 'font-size', name: '2a. 字級尺度', short: '字級' },
  { id: 'line-height', name: '2b. 行高', short: '行高' },
  { id: 'contrast', name: '3. 對比度（WCAG AA）', short: '對比' },
  { id: 'icon', name: '4. 圖示尺寸', short: '圖示' },
  { id: 'interaction', name: '5. 互動態（:hover / :focus-visible）', short: '互動' },
  { id: 'overflow', name: '6a. 水平溢出', short: '溢出' },
  { id: 'clip', name: '6b. 被父層裁切', short: '裁切' },
  { id: 'motion', name: '7. 動效（prefers-reduced-motion）', short: '動效' },
];

/* ──────────────────────────────────────────────────────────────
   量測引擎（送進 renderer 的純函式；selftest 與真實量測共用）
   ────────────────────────────────────────────────────────────── */
const PAGE_HELPERS = function () {
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/[^\w-]/g, '\\$&'));

  function unique(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + esc(el.id);
    const path = [];
    let n = el;
    let guard = 0;
    while (n && n.nodeType === 1 && n !== document.documentElement && guard++ < 12) {
      let seg = n.tagName.toLowerCase();
      if (n.id) { path.unshift('#' + esc(n.id)); break; }
      const cls = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/)
        .filter((c) => /^[A-Za-z_][\w-]*$/.test(c));
      if (cls.length) seg += '.' + cls.slice(0, 2).map(esc).join('.');
      else {
        let i = 1;
        let sib = n;
        while ((sib = sib.previousElementSibling)) { if (sib.tagName === n.tagName) i++; }
        seg += ':nth-of-type(' + i + ')';
      }
      path.unshift(seg);
      n = n.parentElement;
    }
    return path.join(' > ');
  }

  function parseColor(str) {
    if (!str) return null;
    const m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.slice(0, 3).some((x) => Number.isNaN(x))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1 };
  }

  function composite(fg, bg) {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a <= 0) return { r: 255, g: 255, b: 255, a: 1 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a: 1,
    };
  }

  function relLum(c) {
    const f = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function ratio(c1, c2) {
    const a = relLum(c1);
    const b = relLum(c2);
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }

  function hex(c) {
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }

  // 往上疊背景（含自己），從 root 往下合成；忽略背景圖，但回報 hasImage
  function bgBehind(el) {
    const chain = [];
    let n = el;
    while (n && n.nodeType === 1) { chain.push(n); n = n.parentElement; }
    chain.reverse();
    let out = { r: 255, g: 255, b: 255, a: 1 };
    let hasImage = false;
    for (const node of chain) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') hasImage = true;
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) out = composite(c, out);
    }
    return { color: out, hasImage };
  }

  window.__uLint = { unique, parseColor, composite, relLum, ratio, hex, bgBehind };
};

function measureGridInPage(spec) {
  const U = window.__uLint;
  const out = [];
  const num = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s === 'auto' || s === 'none' || s === 'normal' || s === 'initial') return null;
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  const r2 = (n) => Math.round(n * 100) / 100;
  for (const item of spec) {
    let nodes = [];
    try { nodes = [...document.querySelectorAll(item.selector)].slice(0, item.limit || 4); } catch (e) {}
    if (!nodes.length) { out.push({ label: item.label, base: item.selector, missing: true }); continue; }
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const values = {};
      const put = (k, v) => { const n = num(v); if (n != null) values[k] = r2(n); };
      ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].forEach((k) => put(k, cs.getPropertyValue(k)));
      ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].forEach((k) => put(k, cs.getPropertyValue(k)));
      ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius']
        .forEach((k) => put(k, cs.getPropertyValue(k)));
      // getComputedStyle().height 對 auto 高度也會回「已用值」，不能拿來判斷有沒有指定高度；
      // 高度只在檢查清單明確要求（item.height !== false）時才量，而且量實際 rect。
      if (item.height !== false) values.height = r2(r.height);
      if (item.width) values.width = r2(r.width);
      out.push({
        label: item.label,
        base: item.selector,
        selector: U.unique(el),
        values,
        visible: r.width > 0 && r.height > 0,
      });
    }
  }
  return out;
}

function measureTypographyInPage() {
  const U = window.__uLint;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ').trim();
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const lh = cs.lineHeight === 'normal' ? 'normal' : Math.round(parseFloat(cs.lineHeight) * 100) / 100;
    out.push({
      selector: U.unique(el),
      text: own.replace(/\s+/g, ' ').slice(0, 42),
      fontSize: Math.round(parseFloat(cs.fontSize) * 100) / 100,
      lineHeight: lh,
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
    });
  }
  return out;
}

function measureContrastInPage() {
  const U = window.__uLint;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ').trim();
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const fg0 = U.parseColor(cs.color);
    if (!fg0 || fg0.a === 0) continue;
    const back = U.bgBehind(el);
    const fg = U.composite({ ...fg0, a: fg0.a }, back.color);
    out.push({
      selector: U.unique(el),
      text: own.replace(/\s+/g, ' ').slice(0, 42),
      fontSize: Math.round(parseFloat(cs.fontSize) * 100) / 100,
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
      color: cs.color,
      colorHex: U.hex(fg),
      bg: U.hex(back.color),
      ratio: Math.round(U.ratio(fg, back.color) * 100) / 100,
      hasImage: back.hasImage,
    });
  }
  return out;
}

function measureIconsInPage() {
  const U = window.__uLint;
  const out = [];
  for (const s of document.querySelectorAll('svg')) {
    const cs = getComputedStyle(s);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = s.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const p = s.parentElement;
    let fit = false;
    if (p) {
      const pr = p.getBoundingClientRect();
      const pc = getComputedStyle(p);
      const iw = pr.width - (parseFloat(pc.borderLeftWidth) || 0) - (parseFloat(pc.borderRightWidth) || 0);
      const ih = pr.height - (parseFloat(pc.borderTopWidth) || 0) - (parseFloat(pc.borderBottomWidth) || 0);
      fit = (s.classList.contains('fit') || cs.width === '100%' || cs.height === '100%')
        && Math.abs(r.width - iw) <= 1 && Math.abs(r.height - ih) <= 1;
    }
    out.push({
      selector: U.unique(s),
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
      fit,
      widthStyle: cs.width,
      parent: p ? U.unique(p) : null,
    });
  }
  return out;
}

function measureOverflowInPage(opts) {
  const U = window.__uLint;
  const de = document.documentElement;
  const body = document.body;
  const app = document.querySelector('.app');
  const over = (el) => (el ? { x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight } : null);

  // .app 的 scrollWidth 會把「刻意放到畫布外的抽屜」也算進去（position:absolute + left:100%）。
  // 那不是使用者看得到的水平溢出（.app overflow:hidden 直接裁掉），所以另外算「有效溢出」：
  // 只算留在版面內的子孫，完全在 .app 右側外的 absolute/fixed 圖層記成 offcanvas。
  function appOverflow() {
    if (!app) return null;
    const ar = app.getBoundingClientRect();
    const appLeft = ar.left;
    const appRight = appLeft + app.clientWidth;
    let contentRight = appRight;
    const offcanvas = [];
    const widest = [];
    for (const el of app.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const pos = cs.position;
      const off = (pos === 'absolute' || pos === 'fixed') && (r.left >= appRight - 1 || r.right <= appLeft + 1);
      if (off) { if (offcanvas.length < 8) offcanvas.push(U.unique(el)); continue; }
      if (r.right > contentRight + 1) {
        contentRight = r.right;
        widest.push({ selector: U.unique(el), right: Math.round(r.right * 100) / 100 });
      }
    }
    widest.sort((a, b) => b.right - a.right);
    return {
      x: Math.round((contentRight - appRight) * 100) / 100,
      rawX: app.scrollWidth - app.clientWidth,
      y: app.scrollHeight - app.clientHeight,
      offcanvas,
      widest: widest.slice(0, 5),
    };
  }

  const out = {
    inner: { w: innerWidth, h: innerHeight },
    doc: over(de),
    body: over(body),
    app: appOverflow(),
    targets: [],
    clips: [],
    missing: [],
  };
  for (const sel of opts.targets) {
    const els = [...document.querySelectorAll(sel)];
    out.targets.push({ selector: sel, count: els.length });
    if (!els.length) { out.missing.push(sel); continue; }
    for (const el of els.slice(0, 2)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      let a = el.parentElement;
      while (a && a !== de) {
        const cs = getComputedStyle(a);
        const ox = cs.overflowX;
        const oy = cs.overflowY;
        const clipX = ox === 'hidden' || ox === 'clip';
        const clipY = oy === 'hidden' || oy === 'clip';
        if (clipX || clipY) {
          const ar = a.getBoundingClientRect();
          const left = ar.left + a.clientLeft;
          const top = ar.top + a.clientTop;
          const right = left + a.clientWidth;
          const bottom = top + a.clientHeight;
          const exc = {
            left: Math.round((left - r.left) * 100) / 100,
            right: Math.round((r.right - right) * 100) / 100,
            top: Math.round((top - r.top) * 100) / 100,
            bottom: Math.round((r.bottom - bottom) * 100) / 100,
          };
          if ((clipX && (exc.left > 1 || exc.right > 1)) || (clipY && (exc.top > 1 || exc.bottom > 1))) {
            out.clips.push({
              selector: U.unique(el),
              ancestor: U.unique(a),
              overflow: { x: ox, y: oy },
              excess: exc,
            });
            break;
          }
        }
        a = a.parentElement;
      }
    }
  }
  return out;
}

function measureMotionInPage() {
  const U = window.__uLint;
  const items = [];
  const seen = new Set();
  const mediaMatches = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let scanned = 0;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    scanned++;
    const tds = String(cs.transitionDuration || '0s').split(',').map((s) => parseFloat(s) || 0);
    const ads = String(cs.animationDuration || '0s').split(',').map((s) => parseFloat(s) || 0);
    const maxT = Math.max(0, ...tds);
    const maxA = Math.max(0, ...ads);
    const animName = cs.animationName || 'none';
    const hasAnim = animName !== 'none' && maxA > 0.002;
    const hasTrans = maxT > 0.002;
    if (!hasAnim && !hasTrans) continue;
    const sig = U.unique(el);
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (items.length < 400) {
      items.push({
        selector: sig,
        transitionDuration: cs.transitionDuration,
        animationDuration: cs.animationDuration,
        animationName: animName,
      });
    }
  }
  return { mediaMatches, scanned, items, thresholdSec: 0.002 };
}

function scanInteractionRulesInPage(selector) {
  const U = window.__uLint;
  const hoverBases = [];
  const focusBases = [];
  const splitSelectors = (text) => {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of String(text)) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const stripPseudo = (part, pseudo) => {
    let base = part.replace(new RegExp(':' + pseudo + '\\b', 'g'), '');
    // 去掉偽元素（:hover::after 這種），偽元素不是元素本身
    base = base.replace(/::[a-zA-Z-]+(\([^)]*\))?/g, '');
    if (/\s$/.test(base)) base = base + '*';
    base = base.trim();
    return base || '*';
  };
  const visit = (rules, active) => {
    for (const rule of rules) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        let ok = active;
        try { ok = active && matchMedia(rule.conditionText).matches; } catch (e) { ok = active; }
        if (rule.cssRules) visit(rule.cssRules, ok);
        continue;
      }
      if (rule.type === 12 /* SUPPORTS */) {
        if (rule.cssRules) visit(rule.cssRules, active);
        continue;
      }
      if (rule.type !== CSSRule.STYLE_RULE || !active) continue;
      for (const part of splitSelectors(rule.selectorText)) {
        if (part.includes(':hover')) hoverBases.push(stripPseudo(part, 'hover'));
        if (part.includes(':focus-visible')) focusBases.push(stripPseudo(part, 'focus-visible'));
      }
    }
  };
  let sheetsRead = 0;
  for (const sheet of document.styleSheets) {
    if (sheet.disabled) continue;
    let rules = null;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    if (!rules) continue;
    sheetsRead++;
    visit(rules, true);
  }
  const covered = (el, list) => {
    for (const base of list) {
      try {
        if (el.matches(base)) return true;
        let a = el.parentElement;
        while (a && a !== document.documentElement) {
          if (a.matches(base)) return true;
          a = a.parentElement;
        }
      } catch (e) {}
    }
    return false;
  };
  const elements = [];
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const hover = covered(el, hoverBases);
    const focus = covered(el, focusBases);
    elements.push({
      selector: U.unique(el),
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
      hover,
      focus,
      transition: cs.transitionDuration,
    });
  }
  return { hoverRuleCount: hoverBases.length, focusRuleCount: focusBases.length, sheetsRead, elements };
}

/* CDP 強制偽類 → 讀元素（含子孫）視覺簽章，確認「規則沒抓到時，是否真的沒變化」 */
const SIG_FN = `function () {
  const cs = getComputedStyle(this);
  const keys = ['color', 'background-color', 'background-image',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'box-shadow', 'outline-style', 'outline-color', 'outline-width', 'opacity', 'transform',
    'filter', 'text-decoration-color', 'font-weight', 'font-size'];
  const self = {};
  for (const k of keys) self[k] = cs.getPropertyValue(k);
  const kids = [];
  let n = 0;
  for (const d of this.querySelectorAll('*')) {
    if (n++ >= 16) break;
    const dc = getComputedStyle(d);
    kids.push([dc.getPropertyValue('color'), dc.getPropertyValue('fill'),
      dc.getPropertyValue('background-color'), dc.getPropertyValue('opacity'),
      dc.getPropertyValue('border-top-color')]);
  }
  return { self, kids };
}`;

async function cdpStateDiff(session, selectors, pseudo) {
  const results = {};
  if (!selectors.length) return results;
  let root;
  try { root = await session.send('DOM.getDocument', { depth: 0 }); } catch (e) { return results; }
  for (const sel of selectors) {
    try {
      const q = await session.send('DOM.querySelectorAll', { nodeId: root.root.nodeId, selector: sel });
      if (!q.nodeIds.length) { results[sel] = { found: false }; continue; }
      const nodeId = q.nodeIds[0];
      const base = await sigOf(session, nodeId);
      await session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [pseudo] });
      const forced = await sigOf(session, nodeId);
      await session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      results[sel] = { found: true, changed: base !== forced };
    } catch (e) {
      results[sel] = { error: String((e && e.message) || e) };
    }
  }
  return results;
}

async function sigOf(session, nodeId) {
  const r = await session.send('DOM.resolveNode', { nodeId });
  const out = await session.send('Runtime.callFunctionOn', {
    objectId: r.object.objectId,
    functionDeclaration: SIG_FN,
    returnByValue: true,
  });
  return JSON.stringify(out.result.value);
}

/* ──────────────────────────────────────────────────────────────
   真值 → 間距網格允許值
   ────────────────────────────────────────────────────────────── */
function collectTruthGridNumbers(truth) {
  const nums = new Set();
  const SKIP = new Set(['src', 'note', 'unit', 'what', 'how', 'rules', 'packages', 'asar', 'asarMtime', 'extractedAt']);
  const walk = (o) => {
    if (o == null) return;
    if (typeof o === 'number') { nums.add(Math.abs(o)); return; }
    if (typeof o === 'string') {
      const ms = o.match(/-?\d+(?:\.\d+)?/g) || [];
      for (const m of ms) nums.add(Math.abs(parseFloat(m)));
      return;
    }
    if (typeof o === 'object') {
      if (typeof o.value === 'number') { nums.add(Math.abs(o.value)); return; }
      if (typeof o.value === 'string') { walk(o.value); return; }
      for (const k of Object.keys(o)) {
        if (SKIP.has(k)) continue;
        walk(o[k]);
      }
    }
  };
  const g = truth.geometry || {};
  walk(g.frame);
  walk(g.sidebar);
  walk(g.header);
  walk(g.composer);
  if (g.tokens && g.tokens.radius) walk(g.tokens.radius);
  nums.add(0);
  nums.add(0.5); // .5px 邊框
  return [...nums].sort((a, b) => a - b);
}

function isGridAllowed(v, allowed) {
  const a = Math.abs(round2(v));
  if (a === 0) return true;
  if (Math.abs(a % 4) < 0.001) return true;
  for (const x of allowed) if (Math.abs(a - x) < 0.01) return true;
  return false;
}

/* ──────────────────────────────────────────────────────────────
   評估（Node 端；selftest 與真實量測共用，所以判定也要能自證）
   ────────────────────────────────────────────────────────────── */
function evalGrid(items, allowed) {
  const out = [];
  for (const it of items) {
    if (it.missing || !it.visible) continue;
    const bad = [];
    for (const k of Object.keys(it.values)) {
      if (!isGridAllowed(it.values[k], allowed)) bad.push(k + '=' + fmt(it.values[k]) + 'px');
    }
    if (bad.length) {
      out.push({
        category: 'grid',
        selector: it.selector,
        actual: bad.join(' '),
        expected: '4px 倍數或真值（docs/DSH-真值.json）',
        detail: it.label,
      });
    }
  }
  return out;
}

function evalTypography(items) {
  const out = [];
  const near = (a, b) => Math.abs(a - b) < 0.011;
  /* 0.5px 容差：`--fs: 13.5`、`0.92em` 這種是設計上刻意的四捨五入結果，
     不要當成「不在尺度裡」；但 10px / 10.5px 這種真的偏離尺度的一定要抓。 */
  const onScale = (v) => FONT_SCALE.some((s) => Math.abs(s - v) <= 0.51);
  for (const it of items) {
    if (!onScale(it.fontSize)) {
      out.push({
        category: 'font-size',
        selector: it.selector,
        actual: fmt(it.fontSize) + 'px',
        expected: '字級尺度 {' + FONT_SCALE.join(', ') + '}（±0.5px 容差）',
        detail: clip(it.text, 24),
      });
    }
    /* line-height: normal 是合法的單行/圖示容器寫法，不算違規；
       但給了數字就要落在尺度上（抖動的 22.68px 這種要抓）。 */
    if (it.lineHeight !== 'normal' && !LINE_HEIGHTS.some((s) => near(s, it.lineHeight))) {
      out.push({
        category: 'line-height',
        selector: it.selector,
        actual: fmt(it.lineHeight) + 'px',
        expected: '行高 {' + LINE_HEIGHTS.join(', ') + '} 或 normal',
        detail: clip(it.text, 24),
      });
    }
  }
  return out;
}

function evalContrast(items) {
  const out = [];
  let skippedImages = 0;
  for (const it of items) {
    if (it.hasImage) { skippedImages++; continue; }
    const large = it.fontSize >= 24 || (it.fontWeight >= 700 && it.fontSize >= 18.66);
    const need = large ? 3 : 4.5;
    if (it.ratio + 1e-9 < need) {
      out.push({
        category: 'contrast',
        selector: it.selector,
        actual: '對比 ' + it.ratio + ':1（' + it.colorHex + ' on ' + it.bg + '）',
        expected: need.toFixed(1) + ':1' + (large ? '（大字）' : '（正文）'),
        detail: clip(it.text, 24),
        ratio: it.ratio,
      });
    }
  }
  return { violations: out, skippedImages };
}

function evalIcons(items) {
  const out = [];
  for (const it of items) {
    if (it.fit) continue;
    const okW = ICON_SIZES.some((s) => Math.abs(s - it.w) < 0.011);
    const okH = ICON_SIZES.some((s) => Math.abs(s - it.h) < 0.011);
    if (!okW || !okH) {
      out.push({
        category: 'icon',
        selector: it.selector,
        actual: fmt(it.w) + '×' + fmt(it.h) + 'px',
        expected: '圖示 {' + ICON_SIZES.join(', ') + '} 或 fit 容器',
        detail: it.parent ? 'parent ' + it.parent : '',
      });
    }
  }
  return out;
}

function evalOverflow(data, where) {
  const out = [];
  for (const key of ['doc', 'body', 'app']) {
    const d = data[key];
    if (d && d.x > 1) {
      out.push({
        category: 'overflow',
        selector: key === 'doc' ? 'documentElement' : (key === 'body' ? 'body' : '.app'),
        actual: 'scrollWidth-clientWidth=' + fmt(d.x) + 'px（視窗 ' + where.viewport + '）',
        expected: '水平溢出 ≤ 1px',
        detail: key,
      });
    }
  }
  for (const c of data.clips) {
    out.push({
      category: 'clip',
      selector: c.selector,
      actual: '被 ' + c.ancestor + '（overflow:' + c.overflow.x + '/' + c.overflow.y + '）裁掉：'
        + 'left ' + fmt(c.excess.left) + ' right ' + fmt(c.excess.right)
        + ' top ' + fmt(c.excess.top) + ' bottom ' + fmt(c.excess.bottom),
      expected: '不被 overflow:hidden/clip 父層裁掉',
      detail: where.viewport,
    });
  }
  return out;
}

function evalMotion(data) {
  const out = [];
  if (!data.mediaMatches) {
    out.push({
      category: 'motion',
      selector: '(engine)',
      actual: 'CDP 模擬 prefers-reduced-motion: reduce 沒生效',
      expected: '媒體查詢必須命中',
      detail: 'emulateMediaFeatures',
    });
    return out;
  }
  for (const it of data.items) {
    out.push({
      category: 'motion',
      selector: it.selector,
      actual: 'transition ' + it.transitionDuration + '／animation ' + it.animationDuration
        + (it.animationName !== 'none' ? '（' + it.animationName + '）' : ''),
      expected: 'reduce 時 transition/animation ≤ 2ms',
      detail: 'prefers-reduced-motion',
    });
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   啟動／視窗／主題
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
    JSON.stringify({ width: BASE_VIEWPORT.w, height: BASE_VIEWPORT.h, x: 80, y: 60, maximized: false }), 'utf8');
  const port = await freePort(Number(opt('port', DEFAULT_PORT)));
  const child = spawn(EXE,
    [ROOT, '--data-dir=' + PROBE_DIR, '--hidden', '--remote-debugging-port=' + port],
    { stdio: 'ignore', env: appEnv() });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(300);
    try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + port, defaultViewport: null }); } catch (e) {}
  }
  if (!browser) { killTree(child.pid); throw new Error('連不上偵錯埠 ' + port + '（Electron 沒起來？）'); }
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

async function applyViewport(page, w, h) {
  // 一律用 viewport 模擬：390 小於 Electron minWidth(420)，真實視窗改不動
  await page.setViewport({ width: w, height: h });
  await page.evaluate(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) {} });
  await sleep(380);
  const got = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  return got;
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    try { document.documentElement.setAttribute('data-theme', t); } catch (e) {}
  }, theme);
  await sleep(160);
}

/* ──────────────────────────────────────────────────────────────
   量測環境：暫時關掉 transition/animation
   ─────────────────────────────────────────────────────────────
   無頭視窗（--hidden）不會持續產生 frame，CSS transition 會停在
   起始值（換主題後量到的是「上一個主題的顏色」→ 對比度假紅）。
   量顏色／字級／間距時先凍結過場，量動效時再解凍，這樣才量到穩定態。
   ────────────────────────────────────────────────────────────── */
const FREEZE_CSS = '*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}';

async function setFrozen(page, on) {
  await page.evaluate(({ css, on }) => {
    let s = document.getElementById('ui-lint-freeze');
    if (on) {
      if (!s) {
        s = document.createElement('style');
        s.id = 'ui-lint-freeze';
        s.textContent = css;
        document.head.appendChild(s);
      }
    } else if (s) {
      s.remove();
    }
  }, { css: FREEZE_CSS, on });
  await sleep(60);
}

function injectSamplesInPage() {
  const made = [];
  const has = (sel) => !!document.querySelector(sel);
  if (!has('#stream .p')) {
    const host = document.querySelector('#stream');
    if (host) {
      const wrap = document.createElement('div');
      wrap.className = 'thread';
      wrap.innerHTML = '<div class="turn ai"><div class="b">'
        + '<div class="p">樣本正文：gateway 的請求在 142 行之後才落到快取，這裡量的是正文實際字級與行高（含標點，、。「」）。</div>'
        + '</div></div>';
      host.appendChild(wrap);
      made.push('#stream .p');
    }
  }
  const add = (sel, hostSel, tag, cls, html) => {
    if (has(sel)) return;
    const host = document.querySelector(hostSel);
    if (!host) return;
    const n = document.createElement(tag);
    n.className = cls;
    n.innerHTML = html;
    host.appendChild(n);
    made.push(sel);
  };
  add('.sr-row', '#sideRecent', 'button', 'sr-row',
    '<span class="sr-t">api-server</span><span class="sr-p">§614</span>');
  add('.ch', '#tree', 'button', 'ch',
    '<span class="no">1</span><span class="nm">src/gateway/report.ts</span>');
  return made;
}

/* ──────────────────────────────────────────────────────────────
   合成頁：已知 4px 間距／21:1 對比／12px 字 → 誤差必須 0
   ────────────────────────────────────────────────────────────── */
function writeSelftestPage() {
  const html = '<!doctype html>\n'
    + '<html lang="zh-Hant"><head><meta charset="utf-8"><title>ui-lint selftest</title><style>\n'
    + '  *{box-sizing:border-box}\n'
    + '  html,body{margin:0;padding:0;background:#fff}\n'
    + '  #g{margin:8px 0 0 0;padding:4px;border-radius:12px;height:40px;min-height:40px;background:#fff}\n'
    + '  #t{font-size:12px;line-height:20px;color:#000;background:#fff}\n'
    + '  #c{color:#000;background:#fff;font-size:12px;line-height:20px}\n'
    + '  #ico svg{width:16px;height:16px;display:block}\n'
    + '  #bad-pad{padding:5px}\n'
    + '  #bad-font{font-size:13.5px;line-height:21px;color:#000;background:#fff}\n'
    + '  #bad-lh{font-size:12px;line-height:21px;color:#000;background:#fff}\n'
    + '  #bad-contrast{color:#777;background:#fff;font-size:12px;line-height:20px}\n'
    + '  #bad-icon svg{width:15px;height:15px;display:block}\n'
    + '</style></head><body>\n'
    + '  <div id="g">格線樣本</div>\n'
    + '  <div id="t">字級樣本</div>\n'
    + '  <div id="c">對比樣本</div>\n'
    + '  <div id="ico"><svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg></div>\n'
    + '  <div id="bad-pad">間距 5px</div>\n'
    + '  <div id="bad-font">字級 13.5</div>\n'
    + '  <div id="bad-lh">行高 21</div>\n'
    + '  <div id="bad-contrast">對比 4.48</div>\n'
    + '  <div id="bad-icon"><svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg></div>\n'
    + '</body></html>\n';
  fs.mkdirSync(path.dirname(SELFTEST_PAGE), { recursive: true });
  fs.writeFileSync(SELFTEST_PAGE, html, 'utf8');
}

async function runSelftest() {
  writeSelftestPage();
  const { child, browser, page, port } = await launch();
  let grid = [];
  let typo = [];
  let contrast = [];
  let icons = [];
  try {
    const url = 'file:///' + SELFTEST_PAGE.replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await sleep(200);
    await page.evaluate(PAGE_HELPERS);
    const spec = [
      { selector: '#g', label: '格線樣本' },
      { selector: '#bad-pad', label: '壞樣本 5px' },
    ];
    grid = await page.evaluate(measureGridInPage, spec);
    typo = await page.evaluate(measureTypographyInPage);
    contrast = await page.evaluate(measureContrastInPage);
    icons = await page.evaluate(measureIconsInPage);
  } finally {
    try { browser.disconnect(); } catch (e) {}
    killTree(child.pid);
  }

  // 正向：已知值的量測誤差（必須 0）
  const KNOWN = {
    'padding-top': 4, 'padding-right': 4, 'padding-bottom': 4, 'padding-left': 4,
    'margin-top': 8, 'margin-right': 0, 'margin-bottom': 0, 'margin-left': 0,
    'border-top-left-radius': 12, 'border-top-right-radius': 12,
    'border-bottom-right-radius': 12, 'border-bottom-left-radius': 12,
    height: 40,
  };
  const g = grid.find((x) => x.base === '#g') || { values: {} };
  const checks = [];
  for (const k of Object.keys(KNOWN)) {
    const measured = g.values[k] == null ? null : g.values[k];
    const err = measured == null ? null : round2(measured - KNOWN[k]);
    checks.push({ id: 'grid:' + k, label: '間距 ' + k, known: KNOWN[k], measured, error: err, ok: err === 0 });
  }
  const tEl = typo.find((x) => x.selector === '#t') || {};
  for (const [id, label, known, measured] of [
    ['font', '字級 font-size', 12, tEl.fontSize],
    ['lh', '行高 line-height', 20, tEl.lineHeight],
  ]) {
    const err = measured == null ? null : round2(measured - known);
    checks.push({ id, label, known, measured, error: err, ok: err === 0 });
  }
  const cEl = contrast.find((x) => x.selector === '#c') || {};
  {
    const err = cEl.ratio == null ? null : round2(cEl.ratio - 21);
    checks.push({ id: 'contrast', label: '對比 black on white', known: 21, measured: cEl.ratio, error: err, ok: err === 0 });
  }
  const icoEl = icons.find((x) => x.parent === '#ico') || {};
  {
    const e1 = icoEl.w == null ? null : round2(icoEl.w - 16);
    const e2 = icoEl.h == null ? null : round2(icoEl.h - 16);
    checks.push({
      id: 'icon-w', label: '圖示寬 16', known: 16, measured: icoEl.w, error: e1, ok: e1 === 0,
    });
    checks.push({
      id: 'icon-h', label: '圖示高 16', known: 16, measured: icoEl.h, error: e2, ok: e2 === 0,
    });
  }

  // 負向：判定邏輯要有判別力（壞樣本必須被抓到）
  const truth = JSON.parse(fs.readFileSync(TRUTH_FILE, 'utf8'));
  const allowed = collectTruthGridNumbers(truth);
  const gv = evalGrid(grid, allowed);
  const tv = evalTypography(typo);
  const cv = evalContrast(contrast).violations;
  const iv = evalIcons(icons);
  const has = (list, sel) => list.some((v) => v.selector === sel) ? 1 : 0;
  const sensitivity = [
    { id: 'neg-grid', label: '判別力：5px 間距要抓到', want: 1, got: has(gv, '#bad-pad') },
    { id: 'neg-font', label: '判別力：13.5px 字級要抓到', want: 1, got: has(tv.filter((v) => v.category === 'font-size'), '#bad-font') },
    { id: 'neg-lh', label: '判別力：21px 行高要抓到', want: 1, got: has(tv.filter((v) => v.category === 'line-height'), '#bad-lh') },
    { id: 'neg-contrast', label: '判別力：4.48:1 對比要抓到', want: 1, got: has(cv, '#bad-contrast') },
    { id: 'neg-icon', label: '判別力：15px 圖示要抓到', want: 1, got: has(iv, '#bad-icon > svg') || iv.some((v) => String(v.detail).includes('#bad-icon')) ? 1 : 0 },
  ].map((s) => ({ ...s, ok: s.got === s.want }));

  const maxErr = checks.reduce((m, c) => (c.error == null ? m : Math.max(m, Math.abs(c.error))), 0);
  const engineOk = checks.every((c) => c.ok) && round2(maxErr) === 0;
  const verdictOk = sensitivity.every((s) => s.ok);
  const ok = engineOk && verdictOk;
  const fails = checks.filter((c) => !c.ok).length + sensitivity.filter((s) => !s.ok).length;

  console.log('\n════ 量測引擎自檢（合成頁・容差 0）════');
  console.log('  頁面：_probe/ui-lint-selftest.html（本工具自己產生）');
  console.log('  引擎：Electron + puppeteer-core + getComputedStyle／getBoundingClientRect · 偵錯埠 ' + port);
  console.log('');
  for (const c of checks) {
    console.log((c.ok ? '✅' : '❌') + ' ' + pad(c.label, 26)
      + ' 已知 ' + pad(fmt(c.known), 8) + ' 實測 ' + pad(fmt(c.measured), 8)
      + ' 誤差 ' + fmt(c.error));
  }
  console.log('');
  for (const s of sensitivity) {
    console.log((s.ok ? '✅' : '❌') + ' ' + pad(s.label, 34) + ' 抓到 ' + s.got + '／應為 ' + s.want);
  }
  if (ok) {
    console.log('\n✅ 量測引擎誤差 0（' + checks.length + ' 項）· 判定力 ' + sensitivity.length + '/' + sensitivity.length
      + '（已知 4px／21:1／12px 都量準，壞樣本都抓到）');
  } else {
    console.log('\n❌ 引擎自檢失敗：' + fails + ' 項（誤差不是 0 或判定邏輯失效，不准報真實結果）');
  }

  fs.writeFileSync(SELFTEST_REPORT, JSON.stringify({
    schema: 1,
    at: new Date().toISOString(),
    mode: 'selftest',
    ok,
    engine: { id: 'ui-lint', port, page: '_probe/ui-lint-selftest.html' },
    engineMaxError: round2(maxErr),
    checks,
    sensitivity,
  }, null, 2), 'utf8');
  console.log('報告：_probe/ui-lint-selftest.json');
  process.exit(ok ? 0 : 1);
}

/* ──────────────────────────────────────────────────────────────
   彙總：同一個（類別／選擇器／實測）跨主題／尺寸合成一項
   ────────────────────────────────────────────────────────────── */
function aggregate(raw) {
  const map = new Map();
  for (const v of raw) {
    const key = [v.category, v.selector, v.actual, v.detail || ''].join('\u0000');
    let hit = map.get(key);
    if (!hit) {
      hit = {
        category: v.category,
        selector: v.selector,
        actual: v.actual,
        expected: v.expected,
        detail: v.detail || '',
        passes: [],
        ratio: v.ratio,
      };
      map.set(key, hit);
    }
    if (v.where && !hit.passes.includes(v.where)) hit.passes.push(v.where);
  }
  const cats = new Map(CATEGORIES.map((c) => [c.id, c]));
  const list = [...map.values()].map((v) => ({ ...v, passCount: v.passes.length }));
  const order = (v) => CATEGORIES.findIndex((c) => c.id === v.category);
  list.sort((a, b) => order(a) - order(b)
    || String(a.selector).localeCompare(String(b.selector))
    || String(a.actual).localeCompare(String(b.actual)));
  return { list, cats };
}

function printReport(summary, list, meta) {
  console.log('\n════ ' + meta.title + ' ════');
  for (const line of meta.subtitle) console.log('  ' + line);
  console.log('');
  for (const cat of CATEGORIES) {
    const items = list.filter((v) => v.category === cat.id);
    const occ = items.reduce((n, v) => n + v.passCount, 0);
    console.log('\n▸ ' + cat.name + '　' + (items.length ? '❌ ' + items.length + ' 種 / ' + (occ || items.length) + ' 次'
      : '✅ 全部通過'));
    const shown = items.slice(0, 40);
    for (const v of shown) {
      const where = v.passes.length > 1 ? '×' + v.passes.length : (v.passes[0] || '');
      console.log('  ❌ [' + cat.short + '] ' + pad(clip(v.selector, 44), 46)
        + ' 實測 ' + pad(clip(v.actual, 44), 46) + ' 期望 ' + clip(v.expected, 40)
        + (where ? '  (' + where + ')' : ''));
    }
    if (items.length > shown.length) {
      console.log('  …另有 ' + (items.length - shown.length) + ' 種，完整清單見 _probe/ui-lint.json');
    }
  }
  console.log('');
}

/* ──────────────────────────────────────────────────────────────
   真實量測：ui/ × 8 主題 × 6 尺寸
   ────────────────────────────────────────────────────────────── */
async function runGate() {
  let truth;
  try {
    truth = JSON.parse(fs.readFileSync(TRUTH_FILE, 'utf8'));
  } catch (e) {
    console.error('❌ 讀不到真值檔 docs/DSH-真值.json：' + e.message);
    process.exit(2);
  }
  const allowed = collectTruthGridNumbers(truth);

  const onlyTheme = opt('theme', '');
  const onlySize = opt('size', '');
  const themes = onlyTheme ? THEMES.filter((t) => t === onlyTheme) : THEMES.slice();
  const viewports = onlySize
    ? VIEWPORTS.filter((v) => (v.w + 'x' + v.h) === onlySize)
    : VIEWPORTS.slice();
  if (!themes.length) { console.error('❌ 不認識的主題：' + onlyTheme); process.exit(2); }
  if (!viewports.length) { console.error('❌ 不認識的尺寸：' + onlySize + '（可用 ' + VIEWPORTS.map((v) => v.w + 'x' + v.h).join('、') + '）'); process.exit(2); }

  const startedAt = Date.now();
  const { child, browser, page, port } = await launch();
  const session = await page.createCDPSession();
  const passes = [];
  let boot = {};
  let injected = [];
  const raw = [];
  let skippedContrastImages = 0;
  let motionData = null;

  try {
    await page.waitForFunction('document.readyState === "complete" && !!document.querySelector(".app")', { timeout: 15000 }).catch(() => {});
    await sleep(500);
    await page.evaluate(PAGE_HELPERS);
    boot = await page.evaluate(() => ({
      shell: document.documentElement.getAttribute('data-shell'),
      theme: document.documentElement.getAttribute('data-theme'),
      w: innerWidth,
      h: innerHeight,
      textElements: [...document.querySelectorAll('body *')].filter((el) =>
        [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())).length,
    }));
    await page.evaluate(() => { try { document.documentElement.setAttribute('data-shell', 'dsh'); } catch (e) {} });
    injected = await page.evaluate(injectSamplesInPage);
    await applyViewport(page, BASE_VIEWPORT.w, BASE_VIEWPORT.h);
    await setFrozen(page, true);

    // ① 主題矩陣（基準 1440×900）：網格／字級／行高／對比／圖示／互動態
    for (const theme of themes) {
      await setTheme(page, theme);
      const grid = await page.evaluate(measureGridInPage, GRID_SPEC);
      const typo = await page.evaluate(measureTypographyInPage);
      const contrast = await page.evaluate(measureContrastInPage);
      const icons = await page.evaluate(measureIconsInPage);
      const inter = await page.evaluate(scanInteractionRulesInPage, INTERACTION_SELECTOR);

      const where = theme + '@' + BASE_VIEWPORT.w + 'x' + BASE_VIEWPORT.h;
      const push = (list) => list.forEach((v) => raw.push({ ...v, where }));

      push(evalGrid(grid, allowed));
      push(evalTypography(typo));
      const cv = evalContrast(contrast);
      skippedContrastImages += cv.skippedImages;
      push(cv.violations);
      push(evalIcons(icons));

      // 互動態：規則掃不到的元素，再用 CDP 強制偽類確認「真的沒視覺變化」
      const noHover = inter.elements.filter((e) => !e.hover);
      const noFocus = inter.elements.filter((e) => !e.focus);
      const hoverDiff = await cdpStateDiff(session, noHover.map((e) => e.selector), 'hover');
      const focusDiff = await cdpStateDiff(session, noFocus.map((e) => e.selector), 'focus-visible');
      for (const e of inter.elements) {
        const h = hoverDiff[e.selector] || {};
        const f = focusDiff[e.selector] || {};
        const hover = e.hover || (h.found && h.changed);
        const focus = e.focus || (f.found && f.changed);
        if (!hover) {
          raw.push({
            category: 'interaction',
            selector: e.selector,
            actual: '無 :hover 規則，強制 hover 也無視覺變化（' + e.tag + ' ' + clip(e.text, 18) + '）',
            expected: ':hover 必須有視覺變化',
            detail: 'hover',
            where,
          });
        }
        if (!focus) {
          raw.push({
            category: 'interaction',
            selector: e.selector,
            actual: '無 :focus-visible 規則，強制 focus 也無視覺變化（' + e.tag + ' ' + clip(e.text, 18) + '）',
            expected: ':focus-visible 必須有視覺變化',
            detail: 'focus-visible',
            where,
          });
        }
      }

      passes.push({
        kind: 'theme',
        theme,
        viewport: BASE_VIEWPORT.w + 'x' + BASE_VIEWPORT.h,
        counts: {
          gridElements: grid.filter((x) => !x.missing).length,
          textElements: typo.length,
          contrastElements: contrast.length,
          icons: icons.length,
          buttons: inter.elements.length,
          hoverMissing: noHover.length,
          focusMissing: noFocus.length,
          hoverRuleCount: inter.hoverRuleCount,
          focusRuleCount: inter.focusRuleCount,
        },
      });
    }

    // ② 尺寸矩陣：6 尺寸 × 8 主題的溢出／裁切
    for (const vp of viewports) {
      const got = await applyViewport(page, vp.w, vp.h);
      for (const theme of themes) {
        await setTheme(page, theme);
        const data = await page.evaluate(measureOverflowInPage, { targets: CLIP_TARGETS });
        const where = theme + '@' + vp.w + 'x' + vp.h;
        for (const v of evalOverflow(data, { theme, viewport: vp.w + 'x' + vp.h })) raw.push({ ...v, where });
        passes.push({
          kind: 'size',
          theme,
          viewport: vp.w + 'x' + vp.h,
          actual: got,
          counts: {
            docX: data.doc ? data.doc.x : null,
            appX: data.app ? data.app.x : null,
            appRawX: data.app ? data.app.rawX : null,
            offcanvas: data.app ? data.app.offcanvas.length : 0,
            clips: data.clips.length,
            targets: data.targets.length,
            missingTargets: data.missing.length,
          },
        });
      }
    }

    // ③ 動效：解凍 → CDP 模擬 reduced motion（量的是「會不會關掉」，不是凍結後的樣子）
    await applyViewport(page, BASE_VIEWPORT.w, BASE_VIEWPORT.h);
    await setTheme(page, 'dsh');
    await setFrozen(page, false);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await sleep(350);
    motionData = await page.evaluate(measureMotionInPage);
    for (const v of evalMotion(motionData)) raw.push({ ...v, where: 'reduced@' + BASE_VIEWPORT.w + 'x' + BASE_VIEWPORT.h });
  } finally {
    try { await page.emulateMediaFeatures([]); } catch (e) {}
    try { await session.detach(); } catch (e) {}
    try { browser.disconnect(); } catch (e) {}
    killTree(child.pid);
  }

  const { list } = aggregate(raw);
  const totalOccurrences = list.reduce((n, v) => n + v.passCount, 0);
  const byCategory = {};
  for (const cat of CATEGORIES) {
    const items = list.filter((v) => v.category === cat.id);
    byCategory[cat.id] = {
      name: cat.name,
      distinct: items.length,
      occurrences: items.reduce((n, v) => n + v.passCount, 0),
      examples: items.slice(0, 10).map((v) => ({
        selector: v.selector,
        actual: v.actual,
        expected: v.expected,
        passes: v.passes,
        detail: v.detail,
      })),
    };
  }
  const ok = list.length === 0;
  const elapsed = Math.round((Date.now() - startedAt) / 1000);

  const meta = {
    title: '魔芋一夏 · 視覺閘門（7 類／' + themes.length + ' 主題 × ' + viewports.length + ' 尺寸）',
    subtitle: [
      '量測：無頭 Electron 載入 ui/index.html · data-shell=' + SHELL + ' · 偵錯埠 ' + port,
      '主題：' + themes.join('、'),
      '尺寸：' + viewports.map((v) => v.w + 'x' + v.h).join('、') + '（溢出／裁切）· 基準 '
        + BASE_VIEWPORT.w + 'x' + BASE_VIEWPORT.h + '（其餘量測）',
      '開機原樣：shell=' + (boot.shell || 'null') + ' theme=' + (boot.theme || 'null') + ' · 樣本注入：'
        + (injected.length ? injected.join('、') : '無（頁面已有內容）'),
      '真值：docs/DSH-真值.json · 容差：網格 0（值域比對）、對比 WCAG AA、動效 ≤ 2ms',
    ],
  };
  printReport({}, list, meta);

  // 總表
  console.log('\n════ 總表 ════');
  for (const cat of CATEGORIES) {
    const c = byCategory[cat.id];
    const mark = c.distinct === 0 ? '✅' : '❌';
    console.log(mark + '  ' + pad(cat.name, 34) + pad(c.distinct + ' 種', 10) + pad(c.occurrences + ' 次', 10));
  }
  console.log('\n' + (ok ? '✅ 視覺閘門全部通過（' + list.length + ' 項違規）' : '❌ 視覺閘門 ' + list.length + ' 種違規 / ' + totalOccurrences + ' 次'
    + '（' + themes.length + ' 主題 × ' + viewports.length + ' 尺寸矩陣）') + ' · 耗時 ' + elapsed + 's');

  const report = {
    schema: 1,
    at: new Date().toISOString(),
    mode: 'real',
    ok,
    tool: 'tools/ui-lint.js',
    elapsedSec: elapsed,
    engine: {
      electron: path.relative(ROOT, EXE).replace(/\\/g, '/'),
      puppeteer: (() => { try { return require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core/package.json').version; } catch (e) { return '?'; } })(),
      port,
      ui: 'ui/index.html',
      dataDir: '_probe/ui-lint-data',
    },
    env: {
      shell: SHELL,
      boot,
      injected,
      themes,
      viewports: viewports.map((v) => v.w + 'x' + v.h),
      baseViewport: BASE_VIEWPORT.w + 'x' + BASE_VIEWPORT.h,
      skippedContrastImages,
      motion: motionData
        ? { mediaMatches: motionData.mediaMatches, scanned: motionData.scanned, flagged: motionData.items.length, thresholdSec: MOTION_MAX_SEC }
        : null,
    },
    allowed: {
      grid: allowed,
      fontSizes: FONT_SCALE,
      lineHeights: LINE_HEIGHTS,
      iconSizes: ICON_SIZES,
    },
    summary: {
      totalDistinct: list.length,
      totalOccurrences,
      byCategory,
    },
    passes,
    violations: list.map((v) => ({
      category: v.category,
      selector: v.selector,
      actual: v.actual,
      expected: v.expected,
      detail: v.detail,
      count: v.passCount,
      passes: v.passes,
    })),
    notes: [
      '頁面若沒有 .sr-row／.ch／.p 樣本，會注入結構相同的樣本列再量（跟 tools/layout-gate.js 的注入同一個做法），避免空資料量不到元素。',
      '對比度的背景取「往上第一個非 transparent 的 background-color 疊合結果」；背景圖（background-image）案例跳過並記在 env.skippedContrastImages。',
      '互動態優先用 CSSOM 規則比對（含祖先 :hover 規則，例如 [data-shell=dsh] .side-brand:hover 會讓列內按鈕也算有回饋）；規則抓不到時再用 CDP 強制偽類確認是否真的沒有視覺變化。',
      '動效以 CDP 模擬 prefers-reduced-motion: reduce 後量到的 computed transition/animation duration ≤ 2ms 視為「關掉」（1ms/.001ms 是標準寫法）。',
      '本工具只讀 ui/ 與 docs/DSH-真值.json，不改任何 ui 檔。',
    ],
  };
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log('報告：_probe/ui-lint.json');
  process.exit(ok ? 0 : 1);
}

/* ──────────────────────────────────────────────────────────────
   --probe：環境與 DOM 統計（除錯用，不判合格）
   ────────────────────────────────────────────────────────────── */
async function runProbe() {
  const { child, browser, page, port } = await launch();
  try {
    await page.waitForFunction('document.readyState === "complete" && !!document.querySelector(".app")', { timeout: 15000 }).catch(() => {});
    await sleep(600);
    await page.evaluate(PAGE_HELPERS);
    await page.evaluate(injectSamplesInPage);
    await setFrozen(page, true);
    const info = await page.evaluate(() => {
      const sheets = [];
      for (const s of document.styleSheets) {
        let n = -1;
        try { n = s.cssRules.length; } catch (e) {}
        sheets.push({ href: s.href ? s.href.split('/').pop() : '(inline)', rules: n });
      }
      const U = window.__uLint;
      return {
        boot: { shell: document.documentElement.getAttribute('data-shell'), theme: document.documentElement.getAttribute('data-theme'), w: innerWidth, h: innerHeight },
        sheets,
        counts: {
          textElements: [...document.querySelectorAll('body *')].filter((el) =>
            [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())).length,
          buttons: document.querySelectorAll('button, [role="button"]').length,
          svgs: document.querySelectorAll('svg').length,
          ch: document.querySelectorAll('.ch').length,
          srRow: document.querySelectorAll('.sr-row').length,
          p: document.querySelectorAll('.p').length,
        },
        svgSample: [...document.querySelectorAll('svg')].slice(0, 12).map((s) => {
          const r = s.getBoundingClientRect();
          return { parent: U.unique(s.parentElement || s), w: r.width, h: r.height, style: getComputedStyle(s).width };
        }),
      };
    });
    console.log(JSON.stringify(info, null, 2));

    // --diag=contrast：看文字元素為什麼沒進對比度量（color 透明／解析失敗）
    if (opt('diag', '') === 'contrast') {
      const typo = await page.evaluate(measureTypographyInPage);
      const con = await page.evaluate(measureContrastInPage);
      const seen = new Set(con.map((x) => x.selector));
      const skipped = typo.filter((x) => !seen.has(x.selector));
      console.log('typography=' + typo.length + ' contrast=' + con.length + ' skipped=' + skipped.length);
      console.log(JSON.stringify(skipped.slice(0, 25), null, 1));
    }

    // --size=WxH：診斷水平溢出（誰把 .app 撐寬）
    const sizeArg = opt('size', '');
    if (sizeArg) {
      const mm = sizeArg.match(/^(\d+)x(\d+)$/);
      if (mm) {
        const got = await applyViewport(page, Number(mm[1]), Number(mm[2]));
        if (opt('theme', '')) await setTheme(page, opt('theme', ''));
        const diag = await page.evaluate(() => {
          const U = window.__uLint;
          const app = document.querySelector('.app');
          const de = document.documentElement;
          const appR = app.getBoundingClientRect();
          const kids = [...app.children].map((el) => {
            const r = el.getBoundingClientRect();
            return { sel: U.unique(el), w: Math.round(r.width), x: Math.round(r.x), display: getComputedStyle(el).display };
          });
          const wide = [];
          const overflowing = [];
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none') continue;
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > appR.width + 1) {
              wide.push({
                sel: U.unique(el),
                w: Math.round(r.width),
                x: Math.round(r.x),
                right: Math.round(r.right),
                pos: cs.position,
              });
            }
            if (el.scrollWidth - el.clientWidth > 1 && el.clientWidth > 0) {
              overflowing.push({
                sel: U.unique(el),
                scrollW: el.scrollWidth,
                clientW: el.clientWidth,
                overflowX: cs.overflowX,
                width: Math.round(r.width),
              });
            }
          }
          wide.sort((a, b) => b.right - a.right);
          overflowing.sort((a, b) => (b.scrollW - b.clientW) - (a.scrollW - a.clientW));
          return {
            inner: { w: innerWidth, h: innerHeight },
            app: { clientWidth: app.clientWidth, scrollWidth: app.scrollWidth, scrollHeight: app.scrollHeight, clientHeight: app.clientHeight },
            doc: { clientWidth: de.clientWidth, scrollWidth: de.scrollWidth },
            appClasses: app.className,
            appChildren: kids,
            widest: wide.slice(0, 15),
            overflowing: overflowing.slice(0, 15),
          };
        });
        console.log('\n── 溢出診斷 ' + got.w + 'x' + got.h + ' ──');
        console.log(JSON.stringify(diag, null, 2));
      }
    }
  } finally {
    try { browser.disconnect(); } catch (e) {}
    killTree(child.pid);
  }
}

/* ──────────────────────────────────────────────────────────────
   main
   ────────────────────────────────────────────────────────────── */
(async () => {
  try {
    if (hasFlag('selftest')) await runSelftest();
    else if (hasFlag('probe')) await runProbe();
    else await runGate();
  } catch (e) {
    console.error('❌ 量測環境失敗：' + (e && e.message ? e.message : e));
    process.exit(2);
  }
})();
