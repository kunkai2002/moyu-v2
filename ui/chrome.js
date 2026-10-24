/* 應用外殼：頂欄收斂、前進後退、閱讀頁翻章、右鍵選單
   ─────────────────────────────────────────────────────────────
   必須最後載入：把前面所有 wiring 塞進頂欄的文字膠囊收進「⋯」，
   換成圖示按鈕。 */
(function () {
  'use strict';
  const I = window.MOYU_ICONS;
  const D = window.__moyuDebug;
  const $ = (s) => document.querySelector(s);
  if (!I || !D) return;

  const bar = $('.topbar');
  const right = $('.topbar-r');
  if (!bar || !right) return;

  /* ── 樣式 ── */
  const css = document.createElement('style');
  css.textContent = `
  .topbar{height:42px;gap:4px;padding:0 10px}
  .tb-nav{display:flex;gap:2px;flex:none}
  .tb-btn{width:28px;height:28px;border-radius:6px;display:grid;place-items:center;
    color:var(--fg3);border:0;background:none;cursor:pointer;flex:none}
  .tb-btn:hover{background:var(--sel);color:var(--fg)}
  .tb-btn:disabled{opacity:.28;cursor:default;background:none}
  .tb-btn.accent{color:var(--acc)}
  .crumb{font-size:12px;padding-left:6px;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .topbar-r{flex:none}
  .overflow{position:absolute;right:10px;top:44px;width:210px;z-index:60;
    background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:9px;
    box-shadow:0 16px 44px rgba(0,0,0,.5);padding:5px}
  .overflow[hidden]{display:none}
  .ov-row{display:flex;align-items:center;gap:9px;width:100%;padding:7px 9px;border-radius:6px;
    border:0;background:none;color:var(--fg2);font:inherit;font-size:12.5px;cursor:pointer;text-align:left}
  .ov-row:hover{background:var(--sel);color:var(--fg)}
  .ov-row svg{flex:none;color:var(--fg3)}
  .chapter-nav{display:flex;align-items:center;justify-content:center;gap:14px;
    padding:6px 0 8px;flex:none}
  .cn-btn{display:flex;align-items:center;justify-content:center;white-space:nowrap;border:1px solid var(--line);
    border-radius:14px;padding:0;width:28px;height:28px;background:var(--bg-elev);color:var(--fg2);
    font:inherit;font-size:12px;cursor:pointer}
  .cn-btn:hover{border-color:var(--acc);color:var(--fg)}
  .cn-btn:disabled{opacity:.35;cursor:default}
  .cn-pos{font-size:11.5px;color:var(--fg3);font-variant-numeric:tabular-nums;min-width:78px;text-align:center}
  .ctx{position:fixed;z-index:80;min-width:172px;background:var(--bg-elev);
    border:1px solid var(--line-strong);border-radius:8px;box-shadow:0 14px 40px rgba(0,0,0,.55);
    padding:4px;display:none}
  .ctx.on{display:block}
  .ctx-row{display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:5px;
    font-size:12.5px;color:var(--fg2);cursor:pointer;white-space:nowrap}
  .ctx-row:hover{background:var(--sel);color:var(--fg)}
  .ctx-row.danger:hover{background:#7a2e26;color:#fff}
  .ctx-sep{height:1px;background:var(--line);margin:4px 6px}
  `;
  document.head.appendChild(css);

  /* ── 歷史堆疊 ── */
  const hist = { stack: [], pos: -1 };
  const snap = () => ({
    bookId: D.state.book?.id || null,
    bookTitle: D.state.book?.title || '',
    index: D.state.index || 0,
    view: D.state.book ? 'read' : 'home',
  });
  const same = (a, b) => a && b && a.view === b.view && a.bookId === b.bookId && a.index === b.index;

  function push(s) {
    if (same(hist.stack[hist.pos], s)) return;
    hist.stack = hist.stack.slice(0, hist.pos + 1);
    hist.stack.push(s);
    hist.pos = hist.stack.length - 1;
    paintNav();
  }

  function paintNav() {
    const b = $('#tbBack'), f = $('#tbFwd');
    if (b) b.disabled = hist.pos <= 0;
    if (f) f.disabled = hist.pos >= hist.stack.length - 1;
  }

  async function apply(s) {
    if (!s) return;
    if (s.view === 'home') { D.openShelf(); return; }
    if (s.bookId) {
      if (D.state.book?.id !== s.bookId) {
        await D.openBook(s.bookId);
      }
      if (D.state.index !== s.index) D.goChapter(s.index);
    }
  }

  async function back() {
    if (hist.pos <= 0) return;
    hist.pos--;
    await apply(hist.stack[hist.pos]);
    paintNav();
  }
  async function fwd() {
    if (hist.pos >= hist.stack.length - 1) return;
    hist.pos++;
    await apply(hist.stack[hist.pos]);
    paintNav();
  }

  /* 包住既有動作，自動記錄 */
  function wrap(name, marker) {
    const orig = D[name];
    if (typeof orig !== 'function' || orig.__hist) return;
    const w = async function (...args) {
      const r = await orig.apply(this, args);
      push(snap());
      return r;
    };
    w.__hist = marker;
    D[name] = w;
  }
  ['openBook', 'goChapter', 'openShelf'].forEach((n) => wrap(n, true));

  /* ── 重建頂欄 ── */
  const legacy = [...right.children].filter((el) => el !== $('.crumb'));
  right.innerHTML = '';

  const mk = (id, icon, title) => {
    const b = document.createElement('button');
    b.className = 'tb-btn';
    b.id = id;
    b.title = title;
    b.innerHTML = I.svg(icon, 16);
    return b;
  };

  const backBtn = mk('tbBack', 'back', '後退 (Alt+←)');
  const fwdBtn = mk('tbFwd', 'forward', '前進 (Alt+→)');
  backBtn.addEventListener('click', back);
  fwdBtn.addEventListener('click', fwd);

  const homeBtn = mk('tbShelf', 'shelf', '回書架 (Esc)');
  homeBtn.addEventListener('click', () => { D.openShelf(); push(snap()); });

  bar.insertBefore(homeBtn, bar.firstChild);
  bar.insertBefore(fwdBtn, bar.firstChild);
  bar.insertBefore(backBtn, bar.firstChild);

  /* 右側：常用三顆 + 溢出 */
  const markBtn = mk('tbMark', 'bookmark', '標記');
  markBtn.addEventListener('click', () => findLegacy('標記')?.click());
  const listBtn = mk('tbList', 'list', '目錄（篩選章節）');
  listBtn.addEventListener('click', () => $('#chFilter')?.focus());
  const statBtn = mk('tbStat', 'chart', '統計');
  statBtn.addEventListener('click', () => findLegacy('統計')?.click());

  const moreBtn = mk('tbMore', 'more', '更多');
  right.appendChild(listBtn);
  right.appendChild(markBtn);
  right.appendChild(statBtn);
  right.appendChild(moreBtn);

  /* 溢出選單：把所有舊膠囊收進來 */
  const ov = document.createElement('div');
  ov.className = 'overflow';
  ov.hidden = true;
  document.querySelector('.main')?.appendChild(ov);

  const ICON_FOR = {
    最近: 'history', 整本下載: 'down', 下載: 'down', 書評: 'comment',
    統計: 'chart', 標記: 'bookmark', 章節: 'list', 同步: 'upload',
  };

  function findLegacy(label) {
    return [...ov.querySelectorAll('.ov-row')].find((r) => r.textContent.includes(label));
  }

  function sweep() {
    // 把之後才插入右側的膠囊一併收進溢出
    for (const el of [...right.children]) {
      if (el === moreBtn || el.classList.contains('tb-btn')) continue;
      addToOverflow(el);
    }
    // 章節數這種純資訊移到狀態列
    const cb = $('#pillChapters');
    if (cb) cb.remove();
  }

  function addToOverflow(el) {
    if (!el || el.dataset.moved) return;
    el.dataset.moved = '1';
    const label = (el.textContent || '').trim() || '功能';
    const key = Object.keys(ICON_FOR).find((k) => label.startsWith(k));
    const row = document.createElement('button');
    row.className = 'ov-row';
    row.innerHTML = I.svg(ICON_FOR[key] || 'note', 17) + `<span>${label}</span>`;
    row.addEventListener('click', () => {
      ov.hidden = true;
      // 換成原本那顆按鈕的 click，保持原邏輯
      el.click();
    });
    ov.appendChild(row);
    el.remove();
  }

  // 先把既有的收進來
  legacy.forEach(addToOverflow);
  sweep();

  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ov.hidden = !ov.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!ov.hidden && !ov.contains(e.target) && e.target !== moreBtn) ov.hidden = true;
  });

  /* 晚到的膠囊也收 */
  new MutationObserver(() => sweep()).observe(right, { childList: true });

  /* ── 閱讀頁翻章列 ── */
  const composer = $('.composer');
  if (composer) {
    const nav = document.createElement('div');
    nav.className = 'chapter-nav';
    nav.innerHTML = `
      <button class="cn-btn" id="cnPrev">${I.svg('back', 14)}<span>上一章</span></button>
      <span class="cn-pos" id="cnPos">— / —</span>
      <button class="cn-btn" id="cnNext"><span>下一章</span>${I.svg('forward', 14)}</button>`;
    composer.parentNode.insertBefore(nav, composer);

    const prev = nav.querySelector('#cnPrev');
    const next = nav.querySelector('#cnNext');
    const pos = nav.querySelector('#cnPos');

    function paint() {
      const n = D.state.chapters?.length || 0;
      const i = D.state.index || 0;
      pos.textContent = n ? `${i + 1} / ${n}` : '— / —';
      prev.disabled = !n || i <= 0;
      next.disabled = !n || i >= n - 1;
    }
    prev.addEventListener('click', () => { if (D.state.index > 0) { D.goChapter(D.state.index - 1); setTimeout(paint, 60); } });
    next.addEventListener('click', () => {
      const n = D.state.chapters?.length || 0;
      if (D.state.index < n - 1) { D.goChapter(D.state.index + 1); setTimeout(paint, 60); }
    });
    setInterval(paint, 600);
    paint();
  }

  /* ── 右鍵選單 ── */
  const ctx = document.createElement('div');
  ctx.className = 'ctx';
  document.body.appendChild(ctx);
  let ctxTarget = null;

  function showCtx(x, y, items) {
    ctx.innerHTML = '';
    for (const it of items) {
      if (it.sep) { ctx.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-sep' })); continue; }
      const row = document.createElement('div');
      row.className = 'ctx-row' + (it.danger ? ' danger' : '');
      row.innerHTML = (it.icon ? I.svg(it.icon, 15) : '') + `<span>${it.label}</span>`;
      row.addEventListener('click', () => { ctx.classList.remove('on'); it.run && it.run(); });
      ctx.appendChild(row);
    }
    // 避開被右鍵的那一塊：優先放到它右側，右邊不夠就放左側
    const avoid = ctxTarget?.getBoundingClientRect?.();
    const w = 190;
    const h = items.length * 32 + 12;
    if (avoid) {
      let nx = avoid.right + 12;
      if (nx + w > innerWidth - 8) nx = avoid.left - w - 12;
      if (nx < 8) nx = Math.min(x, innerWidth - w - 8);
      let ny = Math.min(avoid.top, innerHeight - h - 8);
      if (ny < 44) ny = 44;
      ctx.style.left = nx + 'px';
      ctx.style.top = ny + 'px';
    } else {
      ctx.style.left = Math.min(x, innerWidth - w) + 'px';
      ctx.style.top = Math.min(y, innerHeight - h) + 'px';
    }
    ctx.style.maxHeight = h + 'px';
    ctx.classList.add('on');
  }

  document.addEventListener('contextmenu', (e) => {
    const ch = e.target.closest('.ch');
    const p = e.target.closest('#stream .p');
    const card = e.target.closest('.shelf-card');

    if (ch) {
      e.preventDefault();
      ctxTarget = ch;
      const idx = [...document.querySelectorAll('#tree .ch')].indexOf(ch);
      showCtx(e.clientX, e.clientY, [
        { label: '跳到這一章', icon: 'forward', run: () => D.goChapter(idx) },
        { label: '複製章節名', icon: 'note', run: () => navigator.clipboard?.writeText(ch.textContent.trim()) },
        { sep: true },
        { label: '整本下載', icon: 'down', run: () => findLegacy('整本下載')?.click() },
      ]);
      return;
    }
    if (p) {
      e.preventDefault();
      ctxTarget = p;
      const text = (p.textContent || '').slice(0, 200);
      showCtx(e.clientX, e.clientY, [
        { label: '劃線 / 取消', icon: 'bookmark', run: () => p.click() },
        { label: '複製這一段', icon: 'note', run: () => navigator.clipboard?.writeText(text) },
        { label: '用這一段搜尋', icon: 'search', run: () => { const f = $('#input'); if (f) { f.value = '/grep ' + text.slice(0, 12); f.focus(); } } },
      ]);
      return;
    }
    if (card) {
      e.preventDefault();
      ctxTarget = card;
      showCtx(e.clientX, e.clientY, [
        { label: '開啟這本書', icon: 'book', run: () => card.click() },
        { label: '整本下載', icon: 'down', run: () => { card.click(); setTimeout(() => findLegacy('整本下載')?.click(), 800); } },
      ]);
    }
  });

  document.addEventListener('click', () => ctx.classList.remove('on'));
  document.addEventListener('scroll', () => ctx.classList.remove('on'), true);

  /* ── 快捷鍵 ── */
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); fwd(); }
    if (e.key === 'Escape' && document.activeElement?.id !== 'input') {
      const open = [...document.querySelectorAll('.panel, .marks-panel, .stats-panel, .overflow')]
        .find((p) => !p.hidden);
      if (open) { open.hidden = true; return; }
      D.openShelf();
    }
  });

  /* 初始狀態 */
  push(snap());
  paintNav();
})();
