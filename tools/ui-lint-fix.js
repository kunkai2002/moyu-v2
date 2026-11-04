/* ═══════════════════════════════════════════════════════════════
   tools/ui-lint-fix.js —— a11y 覆蓋層的「離線預檢」
   ───────────────────────────────────────────────────────────────
   node tools/ui-lint.js 一次要 16 秒（8 主題 × 6 尺寸的無頭 Electron）。
   這支只做純數學：把 ui/a11y-tokens.css 吐出來的每一組「文字色／底色」
   重新算一次 WCAG 對比，只要有一組 < 4.5:1 就 exit 1。

   為什麼需要它：ui-lint 是黑箱（量 DOM），產生器是白箱（算顏色）。
   改配色時先跑這支（<0.1 秒）確認算出來的每一對都過，
   再去跑昂貴的 ui-lint，省得來回 16 秒。

   檢查項目（跟 ui-lint 的對比類一一對應）：
     1. --fg3        × {bg, bg-side, bg-elev, input, module, sidebar-fill}
     2. --a11y-acc-ink × {bg, bg-side}
     3. --a11y-acc-on  × {--a11y-acc-bg}（主鍵：字在實心 accent 上）
     4. --a11y-status-fg / --a11y-status-strong × status-bg（透明時退回 bg）

   用法：
     node tools/ui-lint-fix.js            # 檢查，全過 exit 0
     node tools/ui-lint-fix.js --all      # 連「沒改也過」的組一起列
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const THEMES = ['dsh', 'dsh-light', 'claude-code', 'claude', 'vscode', 'excel', 'terminal', 'word'];
const MIN = 4.5;
const SHOW_ALL = process.argv.includes('--all');

/* ── 讀自訂屬性 ── */
function readDecls(file) {
  const out = new Map();
  const css = fs.readFileSync(file, 'utf8');
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
      const v = decl.slice(i + 1).trim();
      if (k.startsWith('--') && v) map.set(k.replace(/^--/, ''), v);
    }
  }
  return out;
}

const DECLS = new Map();
for (const f of ['theme.css', 'dsh-tokens.css', 'a11y-tokens.css']) {
  const p = path.join(ROOT, 'ui', f);
  if (!fs.existsSync(p)) { console.error('❌ 找不到 ' + p); process.exit(2); }
  for (const [theme, map] of readDecls(p)) {
    if (!DECLS.has(theme)) DECLS.set(theme, new Map());
    for (const [k, v] of map) DECLS.get(theme).set(k, v);
  }
}

/* ── 顏色 ── */
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
const ratio = (a, b) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

function resolve(theme, prop) {
  let name = prop.replace(/^--/, '');
  for (let i = 0; i < 12; i++) {
    const v = (DECLS.get(theme) || new Map()).get(name) ?? (DECLS.get('') || new Map()).get(name);
    if (!v) return null;
    const vm = v.match(VAR_RE);
    if (vm) { name = vm[1]; continue; }
    if (v === 'transparent') return null;
    if (HEX_RE.test(v)) return hexToRgb(v);
    return null;
  }
  return null;
}

/* ── 檢查 ── */
const SURFACES = ['bg', 'bg-side', 'bg-elev', 'dsh-color-input', 'dsh-color-module', 'dsh-color-sidebar-fill'];
const problems = [];
const lines = [];

for (const theme of THEMES) {
  const check = (label, fgProp, bgProp) => {
    const fg = resolve(theme, fgProp);
    const bg = resolve(theme, bgProp);
    if (!fg || !bg) { lines.push({ theme, label, skip: true }); return; }
    const r = ratio(fg, bg);
    const ok = r + 1e-9 >= MIN;
    if (!ok) problems.push({ theme, label, fg: rgbToHex(fg), bg: rgbToHex(bg), ratio: Math.round(r * 100) / 100 });
    lines.push({ theme, label, fg: rgbToHex(fg), bg: rgbToHex(bg), ratio: Math.round(r * 100) / 100, ok });
  };

  for (const s of SURFACES) {
    if (!resolve(theme, s)) continue;
    check('--fg3 on ' + s, 'fg3', s);
  }
  check('--a11y-acc-ink on bg', 'a11y-acc-ink', 'bg');
  if (resolve(theme, 'bg-side')) check('--a11y-acc-ink on bg-side', 'a11y-acc-ink', 'bg-side');
  check('--a11y-acc-on on --a11y-acc-bg', 'a11y-acc-on', 'a11y-acc-bg');
  // 狀態列：透明狀態列＝畫在頁面底色上
  const barBg = resolve(theme, 'status-bg') ? 'status-bg' : 'bg';
  check('--a11y-status-fg on ' + barBg, 'a11y-status-fg', barBg);
  check('--a11y-status-strong on ' + barBg, 'a11y-status-strong', barBg);
}

const shown = lines.filter((l) => SHOW_ALL || (!l.skip && l.ratio < 6));
for (const l of shown) {
  if (l.skip) { console.log('  —  ' + l.theme.padEnd(12) + l.label + '（解析不到，略過）'); continue; }
  console.log('  ' + (l.ok ? '✅' : '❌') + ' ' + l.theme.padEnd(12)
    + l.label.padEnd(38) + String(l.ratio).padStart(6) + ':1  ' + l.fg + ' on ' + l.bg);
}

if (problems.length) {
  console.log('\n❌ ' + problems.length + ' 組對比不到 ' + MIN + ':1：');
  for (const p of problems) console.log('   ' + p.theme + ' ' + p.label + ' ' + p.ratio + ':1（' + p.fg + ' on ' + p.bg + '）');
  process.exit(1);
}
console.log('\n✅ ' + lines.filter((l) => !l.skip).length + ' 組「文字／底色」全部 ≥ ' + MIN + ':1（8 主題）');
