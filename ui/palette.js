/* 命令面板（⌘K／Ctrl+K）
   ─────────────────────────────────────────────────────────────
   方案方向 A 的核心：所有功能先有一個「找得到」的入口，頂欄才有本錢瘦身。
   這裡只做「列 + 搜 + 執行」，不自己實作功能：每一條命令都是去點/呼叫既有的東西，
   所以功能只有一份，不會出現「面板裡有、按鈕沒有」的分裂。
   開啟：⌘K、Ctrl+K；關閉：Esc／點外面；↑↓ 選、Enter 執行。 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const D = () => window.__moyuDebug;

  const click = (sel) => { const el = $(sel); if (el) { el.click(); return true; } return false; };
  const byText = (sel, re) => [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent || ''));

  /* 命令表：label 顯示、hint 一行說明、run 真的去做 */
  function commands() {
    const list = [];
    const add = (label, hint, run, keys) => list.push({ label, hint, run, keys: keys || '' });

    /* 章節與書 */
    add('目錄', '開關左側章節列表', () => click('#tbList'), 'alt+l');
    add('歷史', '最近讀過的書', () => click('#tbHistory'));
    add('標記', '書籤、劃線、筆記', () => click('#tbMark'));
    add('上一章', '回到上一章', () => { const s = D()?.state; if (s?.index > 0) D().goChapter(s.index - 1, { announce: true }); });
    add('下一章', '前往下一章', () => { const s = D()?.state; if (s && s.index < (s.chapters?.length || 0) - 1) D().goChapter(s.index + 1, { announce: true }); });
    add('書架', '打開自己的書架', () => { const b = D()?.openShelf; b ? b() : null; });
    add('首頁', '回到首頁', () => click('#tbHome'));

    /* 面板 */
    add('設定', '主題、字級、同步、版本', () => click('#tbSettings'));
    add('說明', '指令與快捷鍵一覽', () => click('#helpBtn'));
    const stat = byText('.ov-row', /統計/);
    add('統計', '閱讀時數與進度', () => { if (stat) stat.click(); });
    add('檢查更新', '看有沒有新版本', () => { click('#tbSettings'); setTimeout(() => click('#updCheck'), 260); });

    /* 隱身與老闆鍵 */
    add('隱身', '抓桌面顏色當底色', () => window.__moyuGhost?.toggle?.());
    add('老闆鍵', '換成假畫面（Alt+Q）', () => { try { window.moyu?.boss?.(true); } catch {} });

    /* 主題：每一套一個命令 */
    try {
      for (const t of D()?.THEMES || []) add('主題：' + t.name, '切換到 ' + t.name, () => D().setTheme(t.id));
    } catch {}

    return list;
  }

  /* ── UI ── */
  let root = null, input = null, listEl = null, items = [], all = [], sel = 0;

  function build() {
    root = document.createElement('div');
    root.className = 'cmdk';
    root.hidden = true;
    root.innerHTML = `
      <div class="cmdk-card" role="dialog" aria-label="命令面板">
        <input class="cmdk-in" id="cmdkInput" type="text" placeholder="輸入指令或功能名稱…" spellcheck="false" autocomplete="off">
        <div class="cmdk-list" id="cmdkList" role="listbox"></div>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 選擇</span><span><kbd>Enter</kbd> 執行</span><span><kbd>Esc</kbd> 關閉</span></div>
      </div>`;
    document.body.appendChild(root);
    input = root.querySelector('#cmdkInput');
    listEl = root.querySelector('#cmdkList');

    input.addEventListener('input', () => { sel = 0; paint(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); paint(); e.preventDefault(); }
      else if (e.key === 'Enter') { run(items[sel]); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); e.preventDefault(); }
    });
    root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  }

  function paint() {
    const q = (input.value || '').trim().toLowerCase();
    items = !q ? all.slice() : all.filter((c) => (c.label + ' ' + c.hint).toLowerCase().includes(q));
    if (sel >= items.length) sel = Math.max(0, items.length - 1);
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<div class="cmdk-empty">沒有符合的指令</div>';
      return;
    }
    items.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'cmdk-row' + (i === sel ? ' on' : '');
      row.setAttribute('role', 'option');
      row.innerHTML = `<span class="cmdk-l">${c.label}</span><span class="cmdk-h"></span>`;
      row.querySelector('.cmdk-h').textContent = c.hint;
      row.addEventListener('mouseenter', () => { sel = i; paint(); });
      row.addEventListener('click', () => run(c));
      listEl.appendChild(row);
    });
    const on = listEl.querySelector('.cmdk-row.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  let closedAt = 0;
  function open() {
    if (!root) build();
    all = commands();
    input.value = '';
    sel = 0;
    root.hidden = false;
    paint();
    input.focus();
  }
  function close() {
    if (root) root.hidden = true;
    closedAt = Date.now();
  }
  function run(c) {
    if (!c) return;
    close();
    try { c.run(); } catch (e) { console.warn('[cmdk]', c.label, e); }
  }

  document.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'k') {
      e.preventDefault();
      (root && !root.hidden) ? close() : open();
      return;
    }
    if (k === 'escape' && root && !root.hidden) { e.preventDefault(); close(); }
  });

  /* 給測試與其他模組用 */
  window.__moyuCmdk = {
    open, close, run,
    get items() { return items.map((c) => c.label); },
    isOpen: () => !!root && !root.hidden,
    at: () => closedAt,
  };
})();
