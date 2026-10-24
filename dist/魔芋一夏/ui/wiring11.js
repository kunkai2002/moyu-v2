/* 多書切換：最近開啟的書單，一鍵換書（進度各自獨立保存） */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const D = window.__moyuDebug;
  if (!D) return;

  const KEY = 'moyu.recent';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20))); } catch {} };

  /* 包一層 openBook，記下開過的書 */
  const origOpen = D.openBook;
  if (typeof origOpen === 'function' && !origOpen.__wrapped) {
    const wrapped = async function (input) {
      const r = await origOpen.call(this, input);
      const book = D.state.book;
      if (book && book.id) {
        const list = load().filter((x) => x.id !== book.id);
        list.unshift({ id: book.id, title: book.title, at: Date.now() });
        save(list);
        paintBadge();
      }
      return r;
    };
    wrapped.__wrapped = true;
    D.openBook = wrapped;
  }

  const bar = $('.topbar-r');
  if (!bar) return;

  const btn = document.createElement('button');
  btn.className = 'pill';
  btn.textContent = '最近';
  btn.title = '切換書（各書進度獨立保存）';
  bar.insertBefore(btn, bar.firstChild);

  const badge = document.createElement('span');
  badge.className = 'pill';
  badge.hidden = true;
  badge.style.cursor = 'pointer';
  badge.title = '已開啟的書數';
  bar.insertBefore(badge, btn.nextSibling);

  const menu = document.createElement('div');
  menu.className = 'recent-menu';
  menu.hidden = true;
  document.querySelector('.main')?.appendChild(menu);

  const css = document.createElement('style');
  css.textContent = `
  .recent-menu{position:absolute;right:18px;top:44px;width:280px;z-index:47;
    background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;
    box-shadow:0 18px 50px rgba(0,0,0,.5);padding:6px;max-height:320px;overflow:auto}
  .recent-menu[hidden]{display:none}
  .rc-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:6px;cursor:pointer;
    font-size:12.5px;color:var(--fg2)}
  .rc-row:hover{background:var(--sel);color:var(--fg)}
  .rc-row.on{color:var(--fg)}
  .rc-row .rc-t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rc-row .rc-x{color:var(--fg3);font-size:10.5px}
  .rc-empty{padding:14px;color:var(--fg3);font-size:12px;text-align:center}
  `;
  document.head.appendChild(css);

  function paintBadge() {
    const list = load();
    if (!list.length) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.textContent = list.length + ' 本';
  }

  function paintMenu() {
    const list = load();
    const curId = D.state.book?.id;
    if (!list.length) { menu.innerHTML = '<div class="rc-empty">還沒有開過書</div>'; return; }
    menu.innerHTML = '';
    for (const it of list) {
      const row = document.createElement('div');
      row.className = 'rc-row' + (it.id === curId ? ' on' : '');
      row.innerHTML = `<span class="rc-t">${esc(it.title || it.id)}</span>
        <span class="rc-x">${new Date(it.at).toLocaleDateString()}</span>`;
      row.addEventListener('click', () => {
        menu.hidden = true;
        if (it.id !== curId) D.openBook(it.id);
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        save(load().filter((x) => x.id !== it.id));
        paintBadge(); paintMenu();
      });
      menu.appendChild(row);
    }
  }

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  btn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    if (!menu.hidden) paintMenu();
  });
  badge.addEventListener('click', () => { menu.hidden = !menu.hidden; if (!menu.hidden) paintMenu(); });
  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    if (!menu.contains(e.target) && e.target !== btn && e.target !== badge) menu.hidden = true;
  });

  paintBadge();
})();
