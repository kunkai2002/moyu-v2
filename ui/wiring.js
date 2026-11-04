/* 介面接線：讓每個看起來能點的東西真的能點。
   載入順序在 app.js 之後；透過 window.__moyuDebug 取得內部函式。 */
(function () {
  'use strict';
  const D = window.__moyuDebug;
  const $ = (s) => document.querySelector(s);
  if (!D) return;

  const st = D.state;
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem('moyu.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('moyu.' + k, JSON.stringify(v)); } catch {} },
  };

  /* ── 章節篩選 ─────────────────────────────────────────── */
  const filter = $('#chFilter');
  if (filter) {
    const apply = () => {
      const q = filter.value.trim().toLowerCase();
      document.querySelectorAll('#tree .ch').forEach((row) => {
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
    filter.addEventListener('input', apply);
    filter.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { filter.value = ''; apply(); filter.blur(); }
      if (e.key === 'Enter') {
        const first = [...document.querySelectorAll('#tree .ch')].find((r) => r.style.display !== 'none');
        if (first) first.click();
      }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); filter.focus(); filter.select(); }
    });
    // 章節重繪後重新套用
    const tree = $('#tree');
    if (tree) new MutationObserver(apply).observe(tree, { childList: true });
  }

  /* ── 品牌列（書名鈕）→ 書架；舊的 #projRow 已經在 2026-11-04 的 DSH 外殼改版移除 ── */
  const proj = $('#bookName');
  if (proj && !proj.dataset.projBound) {
    proj.dataset.projBound = '1';
    proj.addEventListener('click', () => D.openShelf());
  }

  /* ── 頂部 pill ─────────────────────────────────────────── */
  const pr = $('#pillReviews');
  if (pr) pr.addEventListener('click', () => {
    if (!st.book) { D.openShelf(); return; }
    D.showReviewsInStream();
  });

  /* ── help / settings 面板 ──────────────────────────────── */
  const panel = $('#panel'), helpPanel = $('#helpPanel');
  const toggle = (el, on) => { if (el) el.hidden = on === undefined ? !el.hidden : !on; };

  $('#helpBtn')?.addEventListener('click', () => D.toggleHelp());
  $('#helpClose')?.addEventListener('click', () => toggle(helpPanel, false));
  $('#meRow')?.addEventListener('click', () => openSettings());
  $('#panelClose')?.addEventListener('click', () => toggle(panel, false));

  function openSettings() {
    toggle(panel, true);
    refreshLoginState();
  }
  // 給頂欄齒輪與 /settings 指令用
  window.__moyuOpenSettings = openSettings;

  /* 設定：主題 */
  const sel = $('#setTheme');
  if (sel) {
    const list = [['claude-code', 'Claude Code'], ['claude', 'Claude 奶油白'], ['vscode', 'VS Code'],
      ['excel', 'Excel 報表'], ['terminal', '終端機綠'], ['word', 'Word 文件'],
        ['dsh', 'DeepSeek Harness'], ['dsh-light', 'DSH 淺色']];
    sel.innerHTML = list.map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
    sel.value = document.documentElement.dataset.theme;
    sel.addEventListener('change', () => D.setTheme(sel.value));
    new MutationObserver(() => { sel.value = document.documentElement.dataset.theme; })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* 設定：字級 / 行距 / 串流速度 */
  const CONFIG_KEY = { font: 'fontSize', lh: 'lineHeight', speed: 'streamSpeed' };
  function bindRange(id, label, key, def, apply) {
    const el = $('#' + id), out = $('#' + id + 'V');
    if (!el) return;
    const v = store.get(key, def);
    el.value = v; out.textContent = v; apply(v);
    el.addEventListener('input', () => {
      const n = Number(el.value);
      out.textContent = n; apply(n); store.set(key, n);
      window.moyu?.config?.set?.({ [CONFIG_KEY[key] || key]: n });
    });
  }
  bindRange('setFont', '字級', 'font', 13.5, (v) => document.documentElement.style.setProperty('--fs', v + 'px'));
  bindRange('setLh', '行距', 'lh', 1.95, (v) => document.documentElement.style.setProperty('--lh', v));
  bindRange('setSpeed', '速度', 'speed', 45, (v) => { if (st.config) st.config.streamSpeed = v; });

  /* 設定：登入狀態 */
  async function refreshLoginState() {
    const box = $('#setLoginState'), dataEl = $('#setData');
    try {
      const c = await window.moyu?.config?.get?.();
      if (dataEl) dataEl.textContent = c?.dataDir || '—';
      if (box) box.textContent = c?.loggedIn ? '已登入' : '未登入';
    } catch { if (box) box.textContent = '—'; }
  }
  $('#setLogin')?.addEventListener('click', () => { toggle(panel, false); D.login(); });
  $('#setLogout')?.addEventListener('click', async () => {
    await window.moyu?.cookie?.set?.('');
    refreshLoginState();
  });

  /* ── 自動模式切換（只有圖示）───────────────────────────── */
  const mode = $('#modeTag');
  const ICONS = window.MOYU_ICONS;
  function paintMode() {
    if (!mode) return;
    mode.innerHTML = ICONS ? ICONS.svg(st.autoRead ? 'pause' : 'auto', 14) : '';
    mode.title = st.autoRead ? '自動模式：開' : '自動模式：關';
    mode.dataset.mode = st.autoRead ? 'on' : 'off';
    mode.classList.toggle('on', !!st.autoRead);
  }
  window.__moyuPaintMode = paintMode;
  mode?.addEventListener('click', () => { st.autoRead = !st.autoRead; paintMode(); });
  paintMode();

  /* ── 說明面板（以前叫指令表，現在只剩圖示按鈕）───────────── */
  $('#helpBtn')?.addEventListener('click', () => {
    const p = document.getElementById('helpPanel');
    if (p) p.hidden = !p.hidden;
  });

})();
