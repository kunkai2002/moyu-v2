/* 隱身模式（ghost）
   ─────────────────────────────────────────────────────────────
   把「視窗背後那一塊螢幕」抓下來（main.js 的 ghost:capture，會把視窗透明一瞬），
   然後：
   · 背後是純色 → 直接把那顏色當底色，整個 App 的色階都由它推出來（完全貼合桌面）
   · 背後不是純色 → 把那張圖貼在內容底下（位置剛好對齊視窗），面板改成半透明
   移動或縮放視窗後自動重抓（main 會送 win:moved）。

   開關：/ghost 指令、設定面板的「隱身」列；狀態存在 moyu.ghost。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const B = window.moyu;
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;
  const KEY = 'moyu.ghost';

  const state = { on: false, mode: '', color: '', busy: false, lastError: '' };

  /* 背景圖層：圖片模式時把抓到的畫面貼在這裡（z-index -1，內容在上面） */
  const layer = document.createElement('div');
  layer.className = 'ghost-bg';
  layer.hidden = true;
  const style = document.createElement('style');
  style.textContent = `
    .ghost-bg{position:fixed;inset:0;z-index:-1;display:block;background-repeat:no-repeat;
      background-size:100% 100%;background-position:0 0;pointer-events:none;
      filter:blur(18px) saturate(.92);transform:scale(1.08);transform-origin:center}
    :root[data-ghost="1"] body{background:transparent}
    .ghost-bg[hidden]{display:none}
    /* 隱身模式：面板與輸入框跟著變半透明，桌面才透得上來 */
    :root[data-ghost="1"] .box,
    :root[data-ghost="1"] .panel,
    :root[data-ghost="1"] .marks-panel,
    :root[data-ghost="1"] .stats-panel,
    :root[data-ghost="1"] .hist-panel,
    :root[data-ghost="1"] .phone-panel,
    :root[data-ghost="1"] .overflow,
    :root[data-ghost="1"] .ctx,
    :root[data-ghost="1"] .theme-menu{backdrop-filter:blur(6px)}
  `;
  document.head.appendChild(style);
  document.body.insertBefore(layer, document.body.firstChild);

  /* ── 顏色工具 ── */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return [26, 25, 21];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    h = ((h % 1) + 1) % 1; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      t = ((t % 1) + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const to = (v) => Math.round(clamp(v, 0, 1) * 255);
    const r = to(f(h + 1 / 3)), g = to(f(h)), b = to(f(h - 1 / 3));
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /* 由底色推出一整套色階（深底配亮字、淺底配暗字） */
  function paletteOf(color, translucent) {
    const [h0, s0, l0] = rgbToHsl(...hexToRgb(color));
    const dark = l0 < 0.55;
    const s = Math.min(s0, 0.35);
    const tint = (dl) => hslToHex(h0, s, clamp(l0 + dl, 0.04, 0.97));
    const O = (hex) => (translucent ? rgba(hex, 0.62) : hex);
    const O2 = (hex, a) => (translucent ? rgba(hex, a) : hex);
    if (dark) {
      return {
        '--bg': O(tint(0)),
        '--bg-side': O(tint(-0.03)),
        '--bg-elev': O(tint(0.05)),
        '--sel': O(tint(0.09)),
        '--line': O2(tint(0.16), 0.5),
        '--line-strong': O2(tint(0.26), 0.65),
        '--fg': tint(0.84),
        '--fg2': tint(0.62),
        '--fg3': tint(0.44),
        '--hl': tint(0.14),
        '--status-bg': O(tint(-0.05)),
        '--status-fg': tint(0.5),
      };
    }
    return {
      '--bg': O(tint(0)),
      '--bg-side': O(tint(0.02)),
      '--bg-elev': O(tint(0.05)),
      '--sel': O(tint(-0.07)),
      '--line': O2(tint(-0.14), 0.45),
      '--line-strong': O2(tint(-0.24), 0.6),
      '--fg': tint(-0.82),
      '--fg2': tint(-0.62),
      '--fg3': tint(-0.46),
      '--hl': tint(-0.16),
      '--status-bg': O(tint(0.03)),
      '--status-fg': tint(-0.5),
    };
  }

  function applyPalette(pal) {
    for (const [k, v] of Object.entries(pal)) root.style.setProperty(k, v);
    root.setAttribute('data-ghost', '1');
  }
  function clearPalette() {
    for (const k of ['--bg', '--bg-side', '--bg-elev', '--sel', '--line', '--line-strong',
      '--fg', '--fg2', '--fg3', '--hl', '--status-bg', '--status-fg']) {
      root.style.removeProperty(k);
    }
    root.removeAttribute('data-ghost');
  }

  /* 套用一次抓到的結果 */
  function applyCapture(r) {
    if (!r || !r.ok) {
      state.lastError = (r && r.error) || '抓不到背景';
      updateRow();
      return false;
    }
    state.color = r.color || '';
    state.mode = r.solid ? 'solid' : 'image';
    state.lastError = '';
    applyPalette(paletteOf(r.color, !r.solid));
    if (r.solid) {
      layer.hidden = true;
      layer.style.backgroundImage = '';
    } else {
      layer.hidden = false;
      layer.style.backgroundImage = `url("${r.png}")`;
    }
    try { B?.ghost?.bg?.(r.color); } catch {}
    updateRow();
    return true;
  }

  async function refresh() {
    if (!state.on || !B?.ghost?.capture) return;
    if (state.busy) return;
    state.busy = true;
    try {
      const r = await B.ghost.capture();
      applyCapture(r);
    } catch (e) {
      state.lastError = e.message;
    } finally {
      state.busy = false;
    }
  }

  function setOn(on) {
    state.on = !!on;
    try { localStorage.setItem(KEY, state.on ? '1' : '0'); } catch {}
    if (!state.on) {
      clearPalette();
      layer.hidden = true;
      layer.style.backgroundImage = '';
      try { B?.ghost?.bg?.(''); } catch {}
    } else {
      refresh();
    }
    updateRow();
  }

  /* ── 設定面板那一列 ── */
  let row = null, btn = null, note = null;
  function buildRow() {
    const body = $('#panel .panel-body');
    if (!body || row) return;
    row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<span>隱身</span>';
    btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'ghostToggle';
    btn.addEventListener('click', () => setOn(!state.on));
    note = document.createElement('span');
    note.className = 'muted';
    note.id = 'ghostNote';
    row.appendChild(btn);
    row.appendChild(note);
    body.appendChild(row);
    updateRow();
  }
  function updateRow() {
    if (!btn) return;
    btn.textContent = state.on ? '開' : '關';
    btn.classList.toggle('on', state.on);
    note.textContent = !state.on
      ? '照桌面顏色走'
      : (state.lastError ? state.lastError
        : (state.mode === 'solid' ? `純色 ${state.color}` : `圖片模式 ${state.color}`));
  }

  /* 視窗移動／縮放後重抓（debounce） */
  let moveTimer = null;
  try {
    B?.ghost?.onMoved?.(() => {
      if (!state.on) return;
      clearTimeout(moveTimer);
      moveTimer = setTimeout(refresh, 420);
    });
  } catch {}

  /* 開機：上次開著就繼續開著 */
  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    buildRow();
    let saved = '0';
    try { saved = localStorage.getItem(KEY) || '0'; } catch {}
    if (saved === '1') setOn(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__moyuGhost = {
    get state() { return { ...state }; },
    set: setOn,
    toggle() { setOn(!state.on); },
    refresh,
    /* 測試用：不碰真實螢幕，直接餵一個顏色看色階對不對 */
    applySolid(color) {
      return applyCapture({ ok: true, solid: true, color });
    },
    applyImage(png, color) {
      return applyCapture({ ok: true, solid: false, color: color || state.color || '#808080', png });
    },
    paletteOf,
  };
})();
