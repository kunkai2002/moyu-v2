// 從 DSH 本體（E:\DeepSeek\resources\app.asar）抽「真值」，寫成 docs/DSH-真值.json
//
//   node tools/dsh-truth.js           抽一次並寫檔（= extract）
//   node tools/dsh-truth.js verify    只驗證：JSON 裡的每個數字都還能在 asar 裡找到出處
//
// 原則：**不准手寫數字**。每個值都必須由這裡的規則從真實 CSS／JS 解析出來；
// 只要有規則解析不到，這支腳本就紅燈（不寫檔），不會偷偷用近似值。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASAR = process.env.DSH_ASAR || 'E:/DeepSeek/resources/app.asar';
const OUT = path.join(ROOT, 'docs', 'DSH-真值.json');
const PKG = '/dsh/node_modules/@deepseek-ai/';

/* ── 讀 asar ─────────────────────────────────────────────── */
function openAsar() {
  const fd = fs.openSync(ASAR, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const headerSize = head.readUInt32LE(12);
  const jsonLen = head.readUInt32LE(4);
  const buf = Buffer.alloc(headerSize);
  fs.readSync(fd, buf, 0, headerSize, 16);
  const json = JSON.parse(buf.toString('utf8', 0, jsonLen));
  const files = new Map();
  (function walk(node, base) {
    for (const [k, v] of Object.entries(node.files || {})) {
      if (v.files) walk(v, base + '/' + k);
      else files.set(base + '/' + k, { size: v.size, offset: Number(v.offset) });
    }
  })(json, '');
  return { fd, headerSize, files };
}

function makeReader(a) {
  const cache = new Map();
  return (key) => {
    if (cache.has(key)) return cache.get(key);
    const f = a.files.get(key);
    if (!f) throw new Error('asar 裡找不到：' + key);
    const b = Buffer.alloc(f.size);
    fs.readSync(a.fd, b, 0, f.size, 16 + a.headerSize + f.offset);
    const s = b.toString('utf8');
    cache.set(key, s);
    return s;
  };
}

/* ── CSS 抽取：把 client.js 裡的 css 字串拆成 selector → {prop:value} ── */
function cssStrings(src) {
  const out = [];
  const re = /(?:const|let|var)\s+(css[A-Za-z0-9_$]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src))) {
    out.push({ name: m[1], css: m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\') });
  }
  return out;
}

function cssIndex(src) {
  const index = new Map();
  for (const { css } of cssStrings(src)) {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const sel = m[1].trim().replace(/\s+/g, ' ');
      if (!sel || sel.startsWith('@')) continue;
      const decls = index.get(sel) || {};
      for (const part of m[2].split(';')) {
        const i = part.indexOf(':');
        if (i < 0) continue;
        decls[part.slice(0, i).trim()] = part.slice(i + 1).trim();
      }
      index.set(sel, decls);
    }
  }
  return index;
}

/* ── 兩個來源 ─────────────────────────────────────────────── */
const a = openAsar();
const read = makeReader(a);
const SRC = {
  layout: read(PKG + 'dsh-client-ui-layout/lib/client.js'),
  sidebar: read(PKG + 'dsh-client-ui-sidebar/lib/client.js'),
  conversation: read(PKG + 'dsh-client-ui-conversation/lib/client.js'),
  chat: read(PKG + 'dsh-client-ui-chat/lib/client.js'),
  theme: read(PKG + 'dsh-client-ui-theme/lib/client.js'),
};
const CSS = {};
for (const [k, v] of Object.entries(SRC)) CSS[k] = cssIndex(v);

const problems = [];

/** 從 CSS 取一個宣告（selector + 屬性），取不到就記問題 */
function css(pkg, selector, prop) {
  const rules = CSS[pkg].get(selector);
  if (!rules) { problems.push(`CSS 找不到選擇器 ${pkg} :: ${selector}`); return null; }
  if (!(prop in rules)) { problems.push(`CSS 找不到宣告 ${pkg} :: ${selector} { ${prop} }`); return null; }
  return rules[prop];
}

/** 從 JS 取一個具名常數 */
function konst(pkg, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`);
  const m = re.exec(SRC[pkg]);
  if (!m) { problems.push(`JS 找不到常數 ${pkg} :: ${name}`); return null; }
  return Number(m[1]);
}

/** 從 JS 取 clampWidth(..., min, max) 這種呼叫裡的兩個界 */
function clampRange(pkg, anchor) {
  const i = SRC[pkg].indexOf(anchor);
  if (i < 0) { problems.push(`JS 找不到錨點 ${pkg} :: ${anchor}`); return null; }
  const m = /clampWidth\((\w+),\s*(\d+),\s*(\d+)\)/.exec(SRC[pkg].slice(i, i + 400));
  if (!m) { problems.push(`JS 找不到 clampWidth 界 ${pkg} :: ${anchor}`); return null; }
  return { min: Number(m[2]), max: Number(m[3]) };
}

/* ══ 幾何真值 ══════════════════════════════════════════════ */
const px = (v) => (v === null ? null : Number(String(v).replace(/px$/, '')));

const sidebarDefault = (() => {
  const m = /sidebarPreference = sidebarCollapsed \? 0 : layoutInfo\.sidebar === 0 \? (\d+) :/.exec(SRC.layout);
  if (!m) { problems.push('JS 找不到 sidebar 預設寬（sidebarPreference）'); return null; }
  return Number(m[1]);
})();

const sidebarRange = clampRange('layout', 'function computeColumns');
const rightbarRange = (() => {
  const m = /clampWidth\(rightbar,\s*(\d+),/.exec(SRC.layout);
  if (!m) { problems.push('JS 找不到右欄最小寬（clampWidth(rightbar,300,...)）'); return null; }
  return { min: Number(m[1]), max: null };
})();
const rightbarGap = (() => {
  const m = /const available = viewport - s - (\d+);/.exec(SRC.layout);
  if (!m) { problems.push('JS 找不到右欄保留寬（available）'); return null; }
  return Number(m[1]);
})();

const geometry = {
  frame: {
    sidebarWidth: { value: sidebarDefault, unit: 'px', src: 'dsh-client-ui-layout :: sidebarPreference', note: '側欄預設寬（不是 248px）' },
    sidebarMin: { value: sidebarRange && sidebarRange.min, unit: 'px', src: 'dsh-client-ui-layout :: clampWidth(sidebar,264,420)' },
    sidebarMax: { value: sidebarRange && sidebarRange.max, unit: 'px', src: 'dsh-client-ui-layout :: clampWidth(sidebar,264,420)' },
    railWidth: { value: (() => { const m = /collapsedWidth = (\d+)\)/.exec(SRC.layout); return m ? Number(m[1]) : null; })(), unit: 'px', src: 'dsh-client-ui-layout :: computeColumns(collapsedWidth = 56)', note: '收合時的圖示軌' },
    autoCollapse: { value: konst('layout', 'SIDEBAR_AUTO_COLLAPSE'), unit: 'px', src: 'dsh-client-ui-layout :: SIDEBAR_AUTO_COLLAPSE', note: '視窗小於這個寬度就自動收成軌' },
    rightbarMin: { value: rightbarRange && rightbarRange.min, unit: 'px', src: 'dsh-client-ui-layout :: clampWidth(rightbar,300,...)' },
    rightbarRatio: { value: (() => { const m = /RIGHTBAR_DEFAULT_RATIO = ([\d.]+)/.exec(SRC.layout); return m ? Number(m[1]) : null; })(), unit: 'ratio', src: 'dsh-client-ui-layout :: RIGHTBAR_DEFAULT_RATIO' },
    rightbarMaxRatio: { value: (() => { const m = /RIGHTBAR_MAX_RATIO = ([\d.]+)/.exec(SRC.layout); return m ? Number(m[1]) : null; })(), unit: 'ratio', src: 'dsh-client-ui-layout :: RIGHTBAR_MAX_RATIO' },
    rightbarReserve: { value: rightbarGap, unit: 'px', src: 'dsh-client-ui-layout :: available = viewport - s - 400' },
    sidebarBorder: { value: css('layout', '.mP3x-q_sidebarCol', 'border-right'), src: 'dsh-client-ui-layout :: .mP3x-q_sidebarCol' },
    handleWidth: { value: px(css('layout', '.mP3x-q_handle', 'width')), unit: 'px', src: 'dsh-client-ui-layout :: .mP3x-q_handle' },
    handleOverlap: { value: px(String(css('layout', '.mP3x-q_handle', 'margin-left')).replace('-', '')), unit: 'px', src: 'dsh-client-ui-layout :: .mP3x-q_handle margin-left' },
    leadingSeatTop: { value: px(css('layout', '.mP3x-q_leadingSeat', 'top')), unit: 'px', src: 'dsh-client-ui-layout :: .mP3x-q_leadingSeat' },
    leadingSeatLeft: { value: px(css('layout', '.mP3x-q_leadingSeat', 'left')), unit: 'px', src: 'dsh-client-ui-layout :: .mP3x-q_leadingSeat' },
  },
  sidebar: {
    padding: { value: css('sidebar', '.wtg9ga_root', 'padding'), src: 'dsh-client-ui-sidebar :: .wtg9ga_root' },
    inlinePadding: { value: px((/--dsh-sidebar-inline-padding:\s*(\d+)px/.exec(SRC.sidebar) || [])[1]), unit: 'px', src: 'dsh-client-ui-sidebar :: --dsh-sidebar-inline-padding' },
    fontSize: { value: px(css('sidebar', '.wtg9ga_root', 'font-size')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_root' },
    topStripHeight: { value: px(css('sidebar', '.wtg9ga_topStrip', 'height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_topStrip' },
    logoRowHeight: { value: px(css('sidebar', '.wtg9ga_logoRow', 'height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_logoRow' },
    logoRowGap: { value: px(css('sidebar', '.wtg9ga_logoRow', 'gap')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_logoRow' },
    brandIdentityHeight: { value: px(css('sidebar', '.wtg9ga_brandIdentity', 'height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_brandIdentity' },
    brandFontSize: { value: px(css('sidebar', '.wtg9ga_brandName', 'font-size')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_brandName' },
    brandLineHeight: { value: px(css('sidebar', '.wtg9ga_brandName', 'line-height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_brandName' },
    brandWeight: { value: Number(css('sidebar', '.wtg9ga_brandName', 'font-weight')), src: 'dsh-client-ui-sidebar :: .wtg9ga_brandName' },
    iconButtonSize: { value: px(css('sidebar', '.wtg9ga_iconButton', 'width')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_iconButton' },
    newSessionHeight: { value: px(css('sidebar', '.wtg9ga_newSession', 'height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_newSession' },
    newSessionMargin: { value: css('sidebar', '.wtg9ga_newSession', 'margin'), src: 'dsh-client-ui-sidebar :: .wtg9ga_newSession' },
    newSessionPadding: { value: css('sidebar', '.wtg9ga_newSession', 'padding'), src: 'dsh-client-ui-sidebar :: .wtg9ga_newSession' },
    newSessionBorder: { value: css('sidebar', '.wtg9ga_newSession', 'border'), src: 'dsh-client-ui-sidebar :: .wtg9ga_newSession' },
    newSessionFontSize: { value: px(css('sidebar', '.wtg9ga_newSession', 'font-size')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_newSession' },
    newSessionLineHeight: { value: px(css('sidebar', '.wtg9ga_newSession', 'line-height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_newSession' },
    newSessionWeight: { value: Number(css('sidebar', '.wtg9ga_newSession', 'font-weight')), src: 'dsh-client-ui-sidebar :: .wtg9ga_newSession' },
    panelListGap: { value: px(css('sidebar', '.wtg9ga_panelList', 'gap')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_panelList' },
    panelListBottom: { value: px(css('sidebar', '.wtg9ga_panelList', 'margin-bottom')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_panelList' },
    panelRowMinHeight: { value: px(css('sidebar', '.wtg9ga_panelRow', 'min-height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_panelRow' },
    panelRowPadding: { value: css('sidebar', '.wtg9ga_panelRow', 'padding'), src: 'dsh-client-ui-sidebar :: .wtg9ga_panelRow' },
    panelRowMargin: { value: css('sidebar', '.wtg9ga_panelRow', 'margin'), src: 'dsh-client-ui-sidebar :: .wtg9ga_panelRow' },
    panelRowGap: { value: px(css('sidebar', '.wtg9ga_panelRow', 'gap')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_panelRow' },
    panelRowLineHeight: { value: px(css('sidebar', '.wtg9ga_panelRow', 'line-height')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_panelRow' },
    moreMenuWidth: { value: px(css('sidebar', '.wtg9ga_moreMenu', 'width')), unit: 'px', src: 'dsh-client-ui-sidebar :: .wtg9ga_moreMenu' },
  },
  header: {
    minHeight: { value: px(css('conversation', '.an3WzG_header', 'min-height')), unit: 'px', src: 'dsh-client-ui-conversation :: .an3WzG_header' },
    padding: { value: css('conversation', '.an3WzG_header', 'padding'), src: 'dsh-client-ui-conversation :: .an3WzG_header' },
    borderBottom: { value: css('conversation', '.an3WzG_header', 'border-bottom'), src: 'dsh-client-ui-conversation :: .an3WzG_header' },
    leadingGap: { value: px(css('conversation', '.an3WzG_headerLeading', 'gap')), unit: 'px', src: 'dsh-client-ui-conversation :: .an3WzG_headerLeading' },
    utilitiesMarginLeft: { value: px(css('conversation', '.an3WzG_headerUtilities', 'margin-left')), unit: 'px', src: 'dsh-client-ui-conversation :: .an3WzG_headerUtilities' },
    cornerMarginRight: { value: px(String(css('conversation', '.an3WzG_headerCorner', 'margin-right')).replace('-', '')), unit: 'px', src: 'dsh-client-ui-conversation :: .an3WzG_headerCorner' },
  },
  composer: {
    radius: { value: css('conversation', '.GRgSLq_card', 'border-radius'), src: 'dsh-client-ui-conversation :: .GRgSLq_card', note: '= --dsw-radius-panel 28px' },
    background: { value: css('conversation', '.GRgSLq_card', 'background'), src: 'dsh-client-ui-conversation :: .GRgSLq_card' },
    boxShadow: { value: css('conversation', '.GRgSLq_card', 'box-shadow'), src: 'dsh-client-ui-conversation :: .GRgSLq_card' },
    gap: { value: px(css('conversation', '.GRgSLq_card', 'gap')), unit: 'px', src: 'dsh-client-ui-conversation :: .GRgSLq_card' },
    paddingTop: { value: px(css('conversation', '.GRgSLq_card', 'padding-top')), unit: 'px', src: 'dsh-client-ui-conversation :: .GRgSLq_card' },
    fontSize: { value: css('conversation', '.GRgSLq_card', 'font-size'), src: 'dsh-client-ui-conversation :: .GRgSLq_card' },
    lineHeight: { value: css('conversation', '.GRgSLq_card', 'line-height'), src: 'dsh-client-ui-conversation :: .GRgSLq_card' },
    inputMinHeight: { value: px(css('conversation', '.GRgSLq_input', 'min-height')), unit: 'px', src: 'dsh-client-ui-conversation :: .GRgSLq_input' },
    inputHeroMinHeight: { value: px(css('conversation', '.GRgSLq_hero .GRgSLq_input', 'min-height')), unit: 'px', src: 'dsh-client-ui-conversation :: .GRgSLq_hero .GRgSLq_input' },
    inputPadding: { value: css('conversation', '.GRgSLq_input', 'padding'), src: 'dsh-client-ui-conversation :: .GRgSLq_input' },
    sideClearance: { value: px((/--dsh-composer-side-clearance:(\d+)px/.exec(SRC.conversation) || [])[1]), unit: 'px', src: 'dsh-client-ui-conversation :: --dsh-composer-side-clearance' },
    dockInset: { value: px((/--dsh-composer-dock-inset:(\d+)px/.exec(SRC.conversation) || [])[1]), unit: 'px', src: 'dsh-client-ui-conversation :: --dsh-composer-dock-inset' },
    stackGap: { value: px((/--dsh-composer-stack-gap:(\d+)px/.exec(SRC.conversation) || [])[1]), unit: 'px', src: 'dsh-client-ui-conversation :: --dsh-composer-stack-gap' },
    textMaxHeight: { value: px((/--dsh-composer-text-max-height:(\d+)px/.exec(SRC.conversation) || [])[1]), unit: 'px', src: 'dsh-client-ui-conversation :: --dsh-composer-text-max-height' },
    maxWidthExtra: { value: px((/--dsh-composer-card-max-width:calc\(var\(--dsh-chat-content-width\) \+ (\d+)px\)/.exec(SRC.conversation) || [])[1]), unit: 'px', src: 'dsh-client-ui-conversation :: --dsh-composer-card-max-width' },
    contentWidth: { value: (() => { const m = /--dsh-chat-user-width,clamp\((\d+)px, calc\(var\(--dsh-conversation-column-width,0px\) \* ([\d.]+)\), (\d+)px\)/.exec(SRC.conversation); return m ? `clamp(${m[1]}px, ${m[2]} × 欄寬, ${m[3]}px)` : null; })(), src: 'dsh-client-ui-conversation :: --dsh-chat-content-width' },
  },
  tokens: {
    radius: {
      xs: { value: px((/--dsw-radius-xs:(\d+)px/.exec(SRC.theme) || [])[1]), unit: 'px', src: 'dsh-client-ui-theme :: base.css --dsw-radius-xs' },
      sm: { value: px((/--dsw-radius-sm:(\d+)px/.exec(SRC.theme) || [])[1]), unit: 'px', src: 'dsh-client-ui-theme :: base.css --dsw-radius-sm' },
      md: { value: px((/--dsw-radius-md:(\d+)px/.exec(SRC.theme) || [])[1]), unit: 'px', src: 'dsh-client-ui-theme :: base.css --dsw-radius-md' },
      lg: { value: px((/--dsw-radius-lg:(\d+)px/.exec(SRC.theme) || [])[1]), unit: 'px', src: 'dsh-client-ui-theme :: base.css --dsw-radius-lg' },
      xl: { value: px((/--dsw-radius-xl:(\d+)px/.exec(SRC.theme) || [])[1]), unit: 'px', src: 'dsh-client-ui-theme :: base.css --dsw-radius-xl' },
      panel: { value: px((/--dsw-radius-panel:(\d+)px/.exec(SRC.theme) || [])[1]), unit: 'px', src: 'dsh-client-ui-theme :: base.css --dsw-radius-panel' },
    },
    transition: {
      base: { value: (/--ds-transition-duration:([.\d]+s)/.exec(SRC.theme) || [])[1], src: 'dsh-client-ui-theme :: --ds-transition-duration' },
      fast: { value: (/--ds-transition-duration-fast:([.\d]+s)/.exec(SRC.theme) || [])[1], src: 'dsh-client-ui-theme :: --ds-transition-duration-fast' },
      slow: { value: (/--ds-transition-duration-slow:([.\d]+s)/.exec(SRC.theme) || [])[1], src: 'dsh-client-ui-theme :: --ds-transition-duration-slow' },
      ease: { value: (/--ds-ease-in-out:([^;]+)/.exec(SRC.theme) || [])[1], src: 'dsh-client-ui-theme :: --ds-ease-in-out' },
    },
    font: {
      textFamily: { value: (/--dsh-font-family-text-default:([^;]+)/.exec(SRC.theme) || [])[1], src: 'dsh-client-ui-theme :: base.css --dsh-font-family-text-default' },
      codeFamily: { value: (/--dsh-font-family-code-default:([^;]+)/.exec(SRC.theme) || [])[1], src: 'dsh-client-ui-theme :: base.css --dsh-font-family-code-default' },
      contentSize: { value: (/--dsh-content-font-size,(\d+)px/.exec(SRC.theme) || [])[1] + 'px', src: 'dsh-client-ui-theme :: --dsh-content-font-size 預設' },
      codeSize: { value: (/--dsh-code-font-size,(\d+)px/.exec(SRC.theme) || [])[1] + 'px', src: 'dsh-client-ui-theme :: --dsh-code-font-size 預設' },
      markdownBase: { value: (() => { const m = /--dsw-font-markdown-base:([^;]+)/.exec(SRC.theme); return m ? m[1] : null; })(), src: 'dsh-client-ui-theme :: --dsw-font-markdown-base', note: '正文：14px / 24px / 400' },
      markdownBaseLineHeight: { value: px((/--dsw-font-markdown-base-line-height:calc\((\d+)px/.exec(SRC.theme) || [])[1]), unit: 'px', src: 'dsh-client-ui-theme :: --dsw-font-markdown-base-line-height' },
      markdownH1: { value: (() => { const m = /--dsw-font-markdown-h1:([^;]+)/.exec(SRC.theme); return m ? m[1] : null; })(), src: 'dsh-client-ui-theme :: --dsw-font-markdown-h1' },
      markdownH2: { value: (() => { const m = /--dsw-font-markdown-h2:([^;]+)/.exec(SRC.theme); return m ? m[1] : null; })(), src: 'dsh-client-ui-theme :: --dsw-font-markdown-h2' },
      markdownH3: { value: (() => { const m = /--dsw-font-markdown-h3:([^;]+)/.exec(SRC.theme); return m ? m[1] : null; })(), src: 'dsh-client-ui-theme :: --dsw-font-markdown-h3' },
    },
  },
};

/* ── 色票：static → alias（light / dark）──────────────────── */
const statics = {};
for (const m of SRC.theme.matchAll(/--dsw-static-([a-z0-9-]+):(#[0-9a-fA-F]{3,8})/g)) statics[m[1]] = m[2];

function aliasBlock(marker) {
  const i = SRC.theme.indexOf(marker);
  if (i < 0) { problems.push('theme 找不到 alias 區塊 ' + marker); return {}; }
  const body = SRC.theme.slice(i, i + 24000);
  const out = {};
  for (const m of body.matchAll(/--dsw-alias-([a-z0-9-]+):([^;}]+)/g)) {
    const name = m[1];
    if (out[name]) continue;
    const raw = m[2].trim();
    const st = /^var\(--dsw-static-([a-z0-9-]+)\)$/.exec(raw);
    out[name] = st
      ? { static: st[1], hex: statics[st[1]] || null }
      : { raw, hex: /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : null };
  }
  return out;
}
const light = aliasBlock('body{--dsw-alias-bg-base:');
const dark = aliasBlock('body[data-ds-dark-theme]{--dsw-alias-bg-base:');
const specific = (() => {
  const out = { light: {}, dark: {} };
  for (const [theme, marker] of [['light', 'body{--dsw-alias-bg-base:'], ['dark', 'body[data-ds-dark-theme]{--dsw-alias-bg-base:']]) {
    const i = SRC.theme.indexOf(marker);
    if (i < 0) continue;
    const body = SRC.theme.slice(i, i + 24000);
    for (const m of body.matchAll(/--dsw-specific-([a-z0-9-]+):([^;}]+)/g)) {
      const raw = m[2].trim();
      const st = /^var\(--dsw-static-([a-z0-9-]+)\)$/.exec(raw);
      if (out[theme][m[1]]) continue;
      out[theme][m[1]] = st
        ? { static: st[1], hex: statics[st[1]] || null }
        : { raw, hex: /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : null };
    }
  }
  return out;
})();

const WANT_ALIAS = [
  'bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-overlay', 'bg-module-platform',
  'border-l1', 'border-l2', 'border-l3', 'border-l4',
  'label-primary', 'label-secondary', 'label-tertiary', 'label-caption', 'label-dimmed',
  'brand-primary', 'state-business-primary', 'interactive-bg-hover',
  'button-elevated-fill', 'button-floating-hover',
];
const colors = { light: {}, dark: {} };
for (const k of WANT_ALIAS) {
  colors.light[k] = light[k] || null;
  colors.dark[k] = dark[k] || null;
  if (!light[k]) problems.push('light alias 缺 ' + k);
  if (!dark[k]) problems.push('dark alias 缺 ' + k);
}
const specifics = { light: {}, dark: {} };
for (const k of ['sidebar-fill', 'input-major', 'selector']) {
  specifics.light[k] = specific.light[k] || null;
  specifics.dark[k] = specific.dark[k] || null;
  if (!specific.light[k]) problems.push('light specific 缺 ' + k);
  if (!specific.dark[k]) problems.push('dark specific 缺 ' + k);
}

/* ── 輸出 ─────────────────────────────────────────────────── */
const doc = {
  meta: {
    what: 'DeepSeek Harness（DSH）真實版面數值。魔芋一夏的 DSH 外殼只准讀這份，不准手寫近似值。',
    asar: ASAR,
    asarMtime: fs.existsSync(ASAR) ? fs.statSync(ASAR).mtime.toISOString() : null,
    extractedAt: new Date().toISOString(),
    how: 'node tools/dsh-truth.js（從 asar 內的 client.js CSS 字串與 JS 常數解析）',
    packages: [
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-chat',
      '@deepseek-ai/dsh-client-ui-theme',
    ],
    rules: [
      '每個值都有 src（套件 :: 選擇器或常數），沒有出處就不准加。',
      '「近似值」不算真值：解析不到就讓 tools/dsh-truth.js 紅燈，不要自己填。',
    ],
  },
  geometry,
  colors,
  specifics,
  palette: statics,
};

if (problems.length) {
  console.error('❌ 解析不出真值，沒有寫檔：');
  for (const p of problems) console.error('   - ' + p);
  a.fd && fs.closeSync(a.fd);
  process.exit(1);
}

if (process.argv[2] === 'verify') {
  if (!fs.existsSync(OUT)) { console.error('❌ 還沒有 ' + OUT); process.exit(1); }
  const old = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const same = JSON.stringify(old.geometry) === JSON.stringify(geometry)
    && JSON.stringify(old.colors) === JSON.stringify(colors)
    && JSON.stringify(old.specifics) === JSON.stringify(specifics);
  if (!same) {
    console.error('❌ docs/DSH-真值.json 跟 asar 對不上了（DSH 更新過？）：重跑 node tools/dsh-truth.js');
    process.exit(1);
  }
  console.log('✅ docs/DSH-真值.json 與 asar 一致');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  const count = Object.values(geometry).reduce((n, g) => n + Object.keys(g).length, 0);
  console.log('✅ 寫出 docs/DSH-真值.json ·', count, '個幾何真值 ·', Object.keys(statics).length, '個 static 色票');
}
fs.closeSync(a.fd);
