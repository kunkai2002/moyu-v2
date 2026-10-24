/* 第二批接線：章節欄拖寬／摺疊、下載按鈕、圖標、字級行距
   以 DOM 注入方式實作，不改 index.html 的結構。 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;

  /* ── 樣式 ─────────────────────────────────────────────── */
  const css = document.createElement('style');
  css.textContent = `
  .rz{position:absolute;top:0;bottom:0;right:-3px;width:6px;cursor:col-resize;z-index:20}
  .rz:hover{background:var(--acc)}
  .side{position:relative}
  .app.side-hidden .side{display:none}
  .app.side-hidden .rz{display:none}
  .expand-btn{display:none;position:absolute;left:6px;top:8px;z-index:30;
    width:26px;height:26px;border-radius:6px;border:1px solid var(--line);
    background:var(--bg-elev);color:var(--fg2);cursor:pointer}
  .app.side-hidden .expand-btn{display:grid;place-items:center}
  .expand-btn:hover{color:var(--fg)}
  `;
  document.head.appendChild(css);

  /* ── 圖標（inline SVG，不用額外檔案）───────────────────── */
  if (!$('link[rel="icon"]')) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="#1a1915"/>
        <circle cx="32" cy="32" r="17" fill="none" stroke="#d97757" stroke-width="6"/>
        <circle cx="32" cy="32" r="5" fill="#d97757"/>
      </svg>`);
    document.head.appendChild(link);
  }

  /* ── 章節欄：拖寬 ─────────────────────────────────────── */
  const app = $('.app'), side = $('.side');
  if (app && side) {
    const handle = document.createElement('div');
    handle.className = 'rz';
    handle.title = '拖曳調整寬度';
    side.appendChild(handle);

    const savedW = Number(localStorage.getItem('moyu.sideW') || 0);
    if (savedW >= 180 && savedW <= 560) root.style.setProperty('--side-w', savedW + 'px');

    let dragging = false;
    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const w = Math.max(180, Math.min(560, e.clientX));
      root.style.setProperty('--side-w', w + 'px');
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const w = parseInt(getComputedStyle(root).getPropertyValue('--side-w'), 10);
      if (w) localStorage.setItem('moyu.sideW', String(w));
    });
    handle.addEventListener('dblclick', () => {
      root.style.removeProperty('--side-w');
      localStorage.removeItem('moyu.sideW');
    });
  }

  /* ── 章節欄：摺疊 / 展開 ──────────────────────────────── */
  const head = $('.side-head');
  if (app && head) {
    const collapse = document.createElement('button');
    collapse.className = 'ghost icon';
    collapse.title = '收合章節欄';
    collapse.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    collapse.addEventListener('click', () => {
      app.classList.add('side-hidden');
      localStorage.setItem('moyu.sideHidden', '1');
      expand.style.display = 'grid';
    });
    head.insertBefore(collapse, head.firstChild);

    const expand = document.createElement('button');
    expand.className = 'expand-btn';
    expand.title = '展開章節欄';
    expand.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    expand.addEventListener('click', () => {
      app.classList.remove('side-hidden');
      localStorage.setItem('moyu.sideHidden', '0');
      expand.style.display = 'none';
    });
    document.querySelector('.main')?.appendChild(expand);

    if (localStorage.getItem('moyu.sideHidden') === '1') {
      app.classList.add('side-hidden');
      expand.style.display = 'grid';
    }
  }

  /* ── 下載按鈕（走 app.js 的 /export 指令）────────────────── */
  const bar = $('.topbar-r');
  if (bar) {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.id = 'pillDownload';
    btn.title = '匯出目前這本書（TXT）';
    btn.textContent = '下載';
    btn.addEventListener('click', () => {
      const inp = $('#input');
      if (!inp) return;
      inp.value = '/export';
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    bar.insertBefore(btn, bar.firstChild);
  }

  /* ── 字級 / 行距 存檔還原 ─────────────────────────────── */
  const fs = localStorage.getItem('moyu.font');
  const lh = localStorage.getItem('moyu.lineHeight');
  if (fs) root.style.setProperty('--fs', fs + 'px');
  if (lh) root.style.setProperty('--lh', lh);
})();
