/* 排版設定：字體、段距、欄寬（其餘在既有設定面板） */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;
  const body = $('#panel .panel-body');
  if (!body) return;

  const get = (k, d) => { const v = localStorage.getItem('moyu.' + k); return v === null ? d : v; };
  const set = (k, v) => localStorage.setItem('moyu.' + k, v);

  const FONTS = [
    ['serif', '襯線（宋體）', '"Source Han Serif TC","Noto Serif TC","Songti TC",PMingLiU,Georgia,serif'],
    ['sans', '黑體', '"Microsoft JhengHei UI","PingFang TC","Noto Sans TC",system-ui,sans-serif'],
    ['mono', '等寬', 'var(--mono)'],
  ];

  /* 套用目前設定 */
  function applyFont(id) {
    const f = FONTS.find((x) => x[0] === id) || FONTS[0];
    root.style.setProperty('--text-font', f[2]);
  }
  function applyGap(px) { root.style.setProperty('--para-gap', px + 'px'); }
  function applyWidth(px) { root.style.setProperty('--read-w', px + 'px'); }

  applyFont(get('fontFamily', 'serif'));
  applyGap(get('paraGap', '10'));
  applyWidth(get('readWidth', '900'));

  /* 段距 / 欄寬要生效，補兩條 CSS */
  const css = document.createElement('style');
  css.textContent = `
  .thread{max-width:var(--read-w,900px) !important}
  .p{margin-bottom:var(--para-gap,10px) !important}
  `;
  document.head.appendChild(css);

  /* 在設定面板加三列 */
  const frag = document.createElement('div');

  const fontRow = document.createElement('label');
  fontRow.className = 'row';
  fontRow.innerHTML = '<span>字體</span>';
  const sel = document.createElement('select');
  sel.innerHTML = FONTS.map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
  sel.value = get('fontFamily', 'serif');
  sel.addEventListener('change', () => { applyFont(sel.value); set('fontFamily', sel.value); });
  fontRow.appendChild(sel);
  frag.appendChild(fontRow);

  function rangeRow(label, key, min, max, step, def, unit, apply) {
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<span>${label}</span>`;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step;
    input.value = get(key, def);
    const out = document.createElement('b');
    out.textContent = input.value;
    apply(input.value);
    input.addEventListener('input', () => {
      out.textContent = input.value;
      apply(input.value);
      set(key, input.value);
    });
    row.appendChild(input); row.appendChild(out);
    frag.appendChild(row);
  }

  rangeRow('段距', 'paraGap', 0, 24, 1, 10, 'px', applyGap);
  rangeRow('欄寬', 'readWidth', 600, 1100, 20, 900, 'px', applyWidth);

  body.appendChild(frag);
})();
