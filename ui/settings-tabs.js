/* 設定面板：五頁分頁（外觀／閱讀／帳號／同步／關於）
   ─────────────────────────────────────────────────────────────
   不動 wiring*.js 注入的那些列：等它們長完，再「逐列」依標籤搬進對應的頁。
   有些模組是一次塞一個 wrapper 進來（同步那段），所以要把 wrapper 裡的列拆出來分，
   不能只看最外層。之後才長出來的列也會被即時分頁（觀察器不會停）。
   沒有標籤的列（例如「檢查更新」那顆按鈕）繼承上一列所在的頁。 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  const PAGES = [
    { id: 'look', name: '外觀', keys: ['主題', '字級', '行距', '段距', '欄寬'] },
    { id: 'read', name: '閱讀', keys: ['字體', '串流', '慢讀', '自動', '翻頁'] },
    { id: 'acct', name: '帳號', keys: ['登入', '狀態', '資料夾'] },
    { id: 'sync', name: '同步', keys: ['同步', '網址', '金鑰', '儲存'] },
    { id: 'about', name: '關於', keys: ['版本', '更新', '隱身'] },
  ];
  const KEY = 'moyu.setTab';
  const pageOf = (text) => {
    for (const p of PAGES) if (p.keys.some((k) => text.includes(k))) return p.id;
    return '';
  };
  const labelOf = (row) => ((row.querySelector(':scope > span') || {}).textContent || '').trim();

  let built = false;
  let active = 'look';
  try { active = localStorage.getItem(KEY) || 'look'; } catch {}
  const hosts = new Map();
  let lastPage = 'about';

  /* 把一列搬到它該去的頁 */
  function place(row) {
    const label = labelOf(row);
    const id = label ? (pageOf(label) || 'about') : lastPage;
    if (label) lastPage = id;
    const host = hosts.get(id) || hosts.get('about');
    if (host && row.parentElement !== host) host.appendChild(row);
  }

  /* 依 DOM 順序逐列分頁；wrapper 有列就拆，空殼丟掉 */
  function walk(node) {
    for (const el of [...node.children]) {
      if (el.classList.contains('st-page') || el.classList.contains('st-tabs')) continue;
      if (el.classList.contains('row')) { place(el); continue; }
      const inner = el.querySelectorAll('.row');
      if (inner.length) {
        walk(el);
        if (!el.querySelector('.row') && !el.querySelector('b,strong,h3')) el.remove();
      } else if (el.textContent.trim()) {
        const host = hosts.get(lastPage) || hosts.get('about');
        if (host) host.appendChild(el);
      } else {
        el.remove();
      }
    }
  }

  function build() {
    const panel = $('#panel');
    const body = panel && panel.querySelector('.panel-body');
    if (!panel || !body || built) return;
    if (!body.querySelector('.row')) return;      // 等 wiring 把列長完
    built = true;

    /* 分頁列 */
    const tabs = document.createElement('div');
    tabs.className = 'st-tabs';
    tabs.setAttribute('role', 'tablist');
    panel.insertBefore(tabs, body);

    /* 五個頁面容器 */
    for (const p of PAGES) {
      const host = document.createElement('div');
      host.className = 'st-page';
      host.dataset.page = p.id;
      host.setAttribute('role', 'tabpanel');
      body.appendChild(host);
      hosts.set(p.id, host);
    }

    walk(body);

    for (const p of PAGES) {
      const host = hosts.get(p.id);
      if (!host || !host.children.length) continue;
      const b = document.createElement('button');
      b.className = 'st-tab';
      b.type = 'button';
      b.dataset.page = p.id;
      b.setAttribute('role', 'tab');
      b.textContent = p.name;
      b.addEventListener('click', () => select(p.id));
      tabs.appendChild(b);
    }

    tabs.addEventListener('keydown', (e) => {
      const list = [...tabs.querySelectorAll('.st-tab')];
      const i = list.findIndex((x) => x.dataset.page === active);
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      if (next) { select(next.dataset.page); next.focus(); e.preventDefault(); }
    });

    select(hosts.has(active) ? active : 'look');
  }

  function select(id) {
    active = id;
    try { localStorage.setItem(KEY, id); } catch {}
    for (const b of document.querySelectorAll('#panel .st-tab')) {
      const on = b.dataset.page === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
    for (const h of document.querySelectorAll('#panel .st-page')) h.hidden = h.dataset.page !== id;
  }

  const panel = $('#panel');
  if (panel) {
    const obs = new MutationObserver(() => {
      if (!built) { build(); return; }
      /* 已經建好：後來才長出來的列就地分頁 */
      const body = panel.querySelector('.panel-body');
      if (!body) return;
      for (const el of [...body.children]) {
        if (el.classList.contains('st-page') || el.classList.contains('st-tabs')) continue;
        if (el.classList.contains('row')) place(el);
        else if (el.querySelector('.row')) walk(el);
        else if (el.textContent.trim()) { const h = hosts.get(lastPage) || hosts.get('about'); h && h.appendChild(el); }
        else el.remove();
      }
    });
    obs.observe(panel, { childList: true, subtree: true });
    setTimeout(build, 900);
  }

  window.__moyuSettingsTabs = { select, get active() { return active; } };
})();
