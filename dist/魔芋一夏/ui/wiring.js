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

  /* ── 專案列 → 書架 ─────────────────────────────────────── */
  const proj = $('#projRow');
  if (proj) proj.addEventListener('click', () => D.openShelf());

  /* ── 頂部 pill ─────────────────────────────────────────── */
  const pc = $('#pillChapters');
  if (pc) pc.addEventListener('click', () => {
    const n = st.chapters ? st.chapters.length : 0;
    if (!n) { D.openShelf(); return; }
    document.querySelector('#tree .ch')?.scrollIntoView({ block: 'nearest' });
    filter?.focus();
  });

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

  /* 設定：主題 */
  const sel = $('#setTheme');
  if (sel) {
    const list = [['claude-code', 'Claude Code'], ['claude', 'Claude 奶油白'], ['vscode', 'VS Code'],
      ['excel', 'Excel 報表'], ['terminal', '終端機綠'], ['word', 'Word 文件']];
    sel.innerHTML = list.map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
    sel.value = document.documentElement.dataset.theme;
    sel.addEventListener('change', () => D.setTheme(sel.value));
    new MutationObserver(() => { sel.value = document.documentElement.dataset.theme; })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* 設定：字級 / 行距 / 串流速度 */
  function bindRange(id, label, key, def, apply) {
    const el = $('#' + id), out = $('#' + id + 'V');
    if (!el) return;
    const v = store.get(key, def);
    el.value = v; out.textContent = v; apply(v);
    el.addEventListener('input', () => {
      const n = Number(el.value);
      out.textContent = n; apply(n); store.set(key, n);
      window.moyu?.config?.set?.({ [key === 'font' ? 'fontScale' : key]: n });
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

  /* ── auto-read 切換 ───────────────────────────────────── */
  const mode = $('#modeTag');
  function paintMode() {
    if (mode) mode.textContent = st.autoRead ? '⏵⏵ auto-read on' : '⏸ auto-read off';
  }
  mode?.addEventListener('click', () => { st.autoRead = !st.autoRead; paintMode(); });
  paintMode();

  /* ── 串流裡的「繼續 第 N 章」可點 ──────────────────────── */
  document.addEventListener('click', (e) => {
    const next = e.target.closest?.('.next');
    if (next && st.chapters && st.chapters.length) {
      D.goChapter(Math.min(st.index + 1, st.chapters.length - 1), true);
    }
  });

  /* ── 指令表 ───────────────────────────────────────────── */
  const HELP = [
    ['書號 / 網址', '開一本書'],
    ['/shelf', '我的書架（要登入）'],
    ['/login', '手機掃碼登入'],
    ['/help', '這張表'],
    ['/theme <名字>', '換主題（claude-code / vscode / excel …）'],
    ['/auto', '自動閱讀開關'],
    ['/export', '匯出前 50 章 TXT'],
    ['/boss', '切到假畫面'],
    ['n / Enter', '下一章'],
    ['12', '跳到第 12 章'],
    ['Alt+1~6', '快速換主題'],
    ['Alt+Q', '老闆鍵'],
    ['Ctrl+K', '搜尋章節'],
  ];
  const hl = $('#helpList');
  if (hl) hl.innerHTML = HELP.map(([k, v]) => `<div class="help-row"><code>${k}</code><span>${v}</span></div>`).join('');
})();
