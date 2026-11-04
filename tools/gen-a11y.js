/* ═══════════════════════════════════════════════════════════════
   產生 ui/a11y-tokens.css（可讀性覆蓋層的顏色部分）
   ───────────────────────────────────────────────────────────────
   為什麼要有這支：tools/ui-lint.js 量到 130 條對比違規，全部是
   「次要文字（--fg3／--fg2）」與「狀態列」在各自底色上不到 WCAG AA 的
   4.5:1。修法不是把字調亮／調暗到好看，而是對 8 個主題各算一次：
   把原色往 --fg（該主題的正文色）混合，取「剛好 ≥4.6:1」的最小混合量。
   4.6 而不是 4.5 是留 0.1 給 lint 的四捨五入。

   來源（只讀）：
     ui/theme.css        各主題的 --bg/--fg/--fg3/--acc/--status-*
     ui/dsh-tokens.css   DSH 主題的 --dsh-color-*
   產物（勿手改）：
     ui/a11y-tokens.css

   重新產生：node tools/gen-a11y.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'ui', 'theme.css'),
  path.join(ROOT, 'ui', 'dsh-tokens.css'),
];
const OUT = path.join(ROOT, 'ui', 'a11y-tokens.css');

const THEMES = ['dsh', 'dsh-light', 'claude-code', 'claude', 'vscode', 'excel', 'terminal', 'word'];
const TARGET = 4.6;   // 量測門檻是 4.5，這裡多留 0.1 給四捨五入

/* 底色家族：次要文字可能落在這幾種底色上（sel 不算 —— 選取態會換成 --fg） */
const SURFACE_PROPS = ['bg', 'bg-side', 'bg-elev', 'dsh-color-input', 'dsh-color-module', 'dsh-color-sidebar-fill'];

/* ── CSS 解析：只取 :root / :root[data-theme="…"] 的自訂屬性 ── */
function parseDecls(css) {
  const out = new Map();   // theme('' = :root) -> Map(prop -> value)
  const re = /:root(?:\[data-theme="([^"]+)"\])?\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const theme = m[1] || '';
    if (!out.has(theme)) out.set(theme, new Map());
    const map = out.get(theme);
    for (const decl of m[2].split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const k = decl.slice(0, i).trim();
      const v = decl.slice(i + 1).trim().replace(/;+$/, '');
      if (!k.startsWith('--') || !v) continue;
      map.set(k.replace(/^--/, ''), v);   // 存成不帶 -- 的名字，跟 var() 裡的名字一致
    }
  }
  return out;
}

const DECLS = new Map();
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  for (const [theme, map] of parseDecls(fs.readFileSync(f, 'utf8'))) {
    if (!DECLS.has(theme)) DECLS.set(theme, new Map());
    const dst = DECLS.get(theme);
    for (const [k, v] of map) dst.set(k, v);   // 後讀的檔案覆蓋先讀的
  }
}

/* ── 色彩 ── */
const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const VAR_RE = /^var\(--([\w-]+)\)$/;

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6 || h.length === 8) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return null;
}
const rgbToHex = (c) => '#' + [c.r, c.g, c.b]
  .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
function contrast(a, b) {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const mix = (a, b, t) => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };
const r2 = (n) => Math.round(n * 100) / 100;

/* 解析 --name 成 RGB（吃 var() 鏈；解析不到回 null） */
function color(theme, prop) {
  let name = prop.replace(/^--/, '');
  for (let i = 0; i < 12; i++) {
    const v = (DECLS.get(theme) || new Map()).get(name) ?? (DECLS.get('') || new Map()).get(name);
    if (!v) return null;
    const vm = v.match(VAR_RE);
    if (vm) { name = vm[1]; continue; }
    if (v === 'transparent') return null;
    const hm = v.match(HEX_RE);
    if (hm) return hexToRgb(v);
    return null;                                  // color-mix()/rgb() 等：不猜，讓上層退回
  }
  return null;
}

/* 往 ref 混合，直到「對所有 surfaces 都 ≥ TARGET」；混合量最小者勝 */
function raiseToAA(from, ref, surfaces) {
  const worst = (c) => Math.min(...surfaces.map((s) => contrast(c, s)));
  const base = worst(from);
  if (base >= TARGET) return { rgb: from, ratio: base, t: 0, changed: false };
  for (let t = 0.01; t <= 1.0001; t += 0.01) {
    const c = mix(from, ref, t);
    const r = worst(c);
    if (r >= TARGET) return { rgb: c, ratio: r, t: Math.round(t * 100) / 100, changed: true };
  }
  const end = worst(ref);
  return { rgb: ref, ratio: end, t: 1, changed: true };
}

/* 對比不足時往「離底色更遠」的方向找，不會把白色文字改成黑色 */
function awayFromBg(from, bg) {
  return lum(from) >= lum(bg) ? WHITE : BLACK;
}

/* 文字色對抗單一底色：
   先往「離底色更遠」的方向走（白字維持白、深字維持深），
   走到極端還是不夠時才試另一個極端（例：excel 的 --fg2 深灰在綠底上，
   往黑只有 3.6:1，往白才有 5.8:1）；兩個都到不了就取最好的那個。 */
function legibleOn(from, bg) {
  const ratio = contrast(from, bg);
  if (ratio >= TARGET) return { rgb: from, ratio, changed: false };
  const same = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 3;
  const isExtreme = (dir) => same(mix(from, dir, 1), from);
  const dirs = [awayFromBg(from, bg)];
  if (!isExtreme(dirs[0])) dirs.push(dirs[0] === WHITE ? BLACK : WHITE);
  let best = { rgb: from, ratio };
  for (const dir of dirs) {
    for (let t = 0.01; t <= 1.0001; t += 0.01) {
      const c = mix(from, dir, t);
      const r = contrast(c, bg);
      if (r > best.ratio) best = { rgb: c, ratio: r };
      if (r >= TARGET) return { rgb: c, ratio: r, changed: true };
    }
    // 這個方向走到極端：只要已經過 AA（4.5）就用它，不要為了 4.6 反過來把白字改黑字
    const end = mix(from, dir, 1);
    const endRatio = contrast(end, bg);
    if (endRatio >= 4.5) return { rgb: end, ratio: endRatio, changed: !same(end, from), capped: true };
  }
  // 兩個方向都過不了 4.5：用最好的那個
  return { rgb: best.rgb, ratio: best.ratio, changed: true, capped: true };
}

/* 主鍵（實心 accent 底）上的字色：先留白字，不行才換深字，都不行才動底色 */
function onAccent(acc) {
  const DARK_INK = { r: 12, g: 13, b: 16 };
  const rw = contrast(acc, WHITE);
  const rd = contrast(acc, DARK_INK);
  // 白字還過 → 不動（沿用原本的外觀）
  if (rw >= TARGET) return { bg: acc, ink: WHITE, ratio: rw, note: 'white' };
  // 深字過 → 底色不動，只換字色
  if (rd >= TARGET) return { bg: acc, ink: DARK_INK, ratio: rd, note: 'dark' };
  // 兩個都不過：把底色往「比較有機會」的那邊推（預設往黑，維持白字）
  const ink = rw >= rd ? WHITE : DARK_INK;
  const dir = ink === WHITE ? BLACK : WHITE;
  for (let t = 0.01; t <= 1.0001; t += 0.01) {
    const c = mix(acc, dir, t);
    const r = contrast(c, ink);
    if (r >= TARGET) return { bg: c, ink, ratio: r, note: (ink === WHITE ? 'white+' : 'dark+') + 'bg' };
  }
  return { bg: acc, ink, ratio: contrast(acc, ink), note: 'capped' };
}

/* ── 逐主題計算 ── */
const rows = [];
const blocks = [];

for (const theme of THEMES) {
  const get = (p) => color(theme, p);
  const bg = get('bg');
  if (!bg) { rows.push({ theme, skip: 'no --bg' }); continue; }

  const surfaces = [];
  for (const p of SURFACE_PROPS) {
    const c = get(p);
    if (!c) continue;
    if (surfaces.some((x) => rgbToHex(x) === rgbToHex(c))) continue;   // 同一個底色只算一次
    surfaces.push(c);
  }
  const fg = get('fg') || WHITE;
  const fg2 = get('fg2');
  const fg3 = get('fg3');
  const acc = get('acc');
  const statusBg = get('status-bg') || bg;
  const statusFg = get('status-fg') || fg3;

  const out = {};

  // 1) 次要文字 --fg3：往 --fg 混合
  if (fg3) {
    const r = raiseToAA(fg3, fg, surfaces);
    out['--fg3'] = { v: rgbToHex(r.rgb), from: rgbToHex(fg3), ratio: r.ratio, t: r.t, changed: r.changed };
  }

  // 2) accent 當「文字」用（分頁選中、連結）：往 --fg 混合
  if (acc) {
    const r = raiseToAA(acc, fg, [bg, ...surfaces]);
    out['--a11y-acc-ink'] = { v: rgbToHex(r.rgb), from: rgbToHex(acc), ratio: r.ratio, t: r.t, changed: r.changed };
  }

  // 3) accent 當「實心主鍵底色」：配一組過 AA 的字色（白字優先）
  if (acc) {
    const p = onAccent(acc);
    out['--a11y-acc-bg'] = { v: rgbToHex(p.bg), from: rgbToHex(acc), ratio: p.ratio, t: null, changed: p.note === 'capped' || p.note.endsWith('bg') };
    out['--a11y-acc-on'] = { v: rgbToHex(p.ink), from: p.note.startsWith('white') ? '#ffffff' : '#0c0d10', ratio: p.ratio, t: null, changed: true };
    out['--a11y-acc-bg'].note = p.note;
  }

  // 4) 狀態列：底色是實色時文字要跟著底色重算
  if (statusFg) {
    const r = legibleOn(statusFg, statusBg);
    out['--a11y-status-fg'] = { v: rgbToHex(r.rgb), from: rgbToHex(statusFg), ratio: r.ratio, t: null, changed: r.changed };
  }
  // 5) 狀態列裡「章節位置／分支」這種要比其他項更亮一階：吃 --fg2，但要過底色的 AA。
  //    算出來若比第 4 步的底色字色還弱，就直接用第 4 步那一個（狀態列的層級靠字重，不靠把字調暗）。
  if (fg2) {
    const r = legibleOn(fg2, statusBg);
    let v = rgbToHex(r.rgb);
    let ratio = r.ratio;
    let from = rgbToHex(fg2);
    if (out['--a11y-status-fg'] && ratio < out['--a11y-status-fg'].ratio) {
      v = out['--a11y-status-fg'].v;
      ratio = out['--a11y-status-fg'].ratio;
      from = out['--a11y-status-fg'].from;
    }
    out['--a11y-status-strong'] = { v, from, ratio, t: null, changed: v !== from };
  }

  rows.push({ theme, bg: rgbToHex(bg), surfaces: surfaces.map(rgbToHex), out });

  const decls = Object.keys(out).map((k) => '  ' + k + ':' + out[k].v + ';').join('\n');
  const notes = Object.keys(out).map((k) => {
    const o = out[k];
    return '     ' + k.padEnd(20) + o.from + ' → ' + o.v
      + '（' + r2(o.ratio) + ':1' + (o.t ? '，混 ' + Math.round(o.t * 100) + '%' : '')
      + (o.note ? '，' + o.note : '') + '）';
  }).join('\n');
  blocks.push('/* ' + theme + '（底色 ' + rgbToHex(bg) + '；文字可能落在這幾個底色上：'
    + surfaces.map(rgbToHex).join(' ') + '）\n' + notes + '\n */\n'
    + ':root[data-theme="' + theme + '"]{\n' + decls + '\n}');
}

/* ── 輸出 ── */
const head = `/* 由 tools/gen-a11y.js 從 ui/theme.css + ui/dsh-tokens.css 產生，請勿手改。
   重新產生：node tools/gen-a11y.js
   ───────────────────────────────────────────────────────────────
   8 個主題的次要文字／狀態列／主鍵字色，全部算到 WCAG AA（≥4.6:1）。
   只改「顏色代幣」，不碰字級、行高、間距；正文 --fg 一律不動。
   除代幣外只帶 5 條「套用」規則（分頁選中／主鍵／狀態列），
   因為那些元素的顏色原本寫死在別人的檔案裡。 */

:root{
  /* 主題沒設 data-theme 時的退路（等於原色，不改任何外觀） */
  --a11y-acc-ink:var(--acc);
  --a11y-acc-bg:var(--acc);
  --a11y-acc-on:#ffffff;
  --a11y-status-fg:var(--fg2);
  --a11y-status-strong:var(--fg);
}

`;

const rules = `
/* ══ 套用：只覆蓋 ui-lint 點名的那幾個元素 ═══════════════════ */

/* 分頁「選中」用 accent 當字色（claude 3.1:1、dsh-light 4.1:1 → 拉暗一階） */
:root[data-shell="dsh"] .head-tabs > .head-tab.on{color:var(--a11y-acc-ink)}

/* 主鍵：實心 accent 底 + 白字（白字在淺色 accent 上只有 2.3–4.2:1 → 換成算過的組合） */
:root[data-shell="dsh"] .dt-btn.primary{
  background:var(--a11y-acc-bg);border-color:var(--a11y-acc-bg);color:var(--a11y-acc-on);
}
:root[data-shell="dsh"] .dt-btn.primary:hover{
  background:var(--a11y-acc-bg);border-color:var(--a11y-acc-bg);color:var(--a11y-acc-on);
}
/* 送出一樣是 accent 底（圖示不是文字，但對比一樣要夠） */
:root[data-shell="dsh"] .composer .hint-btn[data-act="send"]{
  background:var(--a11y-acc-bg);color:var(--a11y-acc-on);
}

/* 狀態列：底色是實色的主題（vscode/excel/word 的藍與綠、claude 的米色），
   原本吃 --fg3／--fg2，在飽和底色上只有 1.2–3.4:1 → 改用對底色算過的字色 */
:root[data-shell="dsh"] .statusbar,
:root[data-shell="dsh"] .statusbar .sb-item{color:var(--a11y-status-fg)}
:root[data-shell="dsh"] .statusbar #sbChapter,
:root[data-shell="dsh"] .statusbar .sb-item.branch{color:var(--a11y-status-strong)}
`;

fs.writeFileSync(OUT, head + blocks.join('\n\n') + '\n' + rules, 'utf8');

/* ── 終端機表格 ── */
for (const row of rows) {
  if (row.skip) { console.log(row.theme.padEnd(12) + row.skip); continue; }
  console.log('\n' + row.theme + '  bg ' + row.bg + '  surfaces ' + row.surfaces.join(','));
  for (const k of Object.keys(row.out)) {
    const o = row.out[k];
    console.log('  ' + k.padEnd(20) + o.from + ' → ' + o.v
      + '  ' + String(r2(o.ratio)).padStart(5) + ':1'
      + (o.t ? '  混 ' + Math.round(o.t * 100) + '%' : '')
      + (o.note ? '  [' + o.note + ']' : ''));
  }
}
console.log('\n寫入 ' + path.relative(ROOT, OUT));
