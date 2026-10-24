/* 魔芋一夏 · 手機版邏輯
   共用同一台本機服務器的 /api/*（書架、章節、書評、掃碼登入）。 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const api = async (p, o) => {
    const r = await fetch(p, o);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  };
  const post = (p, b) => api(p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
  });

  const st = {
    shelf: [], book: null, chapters: [], index: 0,
    font: +(localStorage.getItem('m.font') || 18),
    lh: +(localStorage.getItem('m.lh') || 1.9),
    bg: localStorage.getItem('m.bg') || 'paper',
    gap: 10,
  };

  /* ── 頁籤 ── */
  const pages = { shelf: $('#pShelf'), search: $('#pSearch'), me: $('#pMe') };
  function tab(name) {
    for (const k of Object.keys(pages)) pages[k].hidden = k !== name;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
    if (name === 'me') loadMe();
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => tab(t.dataset.tab)));

  /* ── 書架 ── */
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const ART = {
    login: "<circle cx='32' cy='26' r='9'/><path d='M14 54c0-10 8-16 18-16s18 6 18 16'/>",
    book: "<path d='M12 10h24a6 6 0 0 1 6 6v38H18a6 6 0 0 0-6 6z'/><path d='M12 10v50'/>",
    wifi: "<path d='M10 40a30 30 0 0 1 44 0'/><path d='M20 49a18 18 0 0 1 24 0'/><circle cx='32' cy='57' r='2'/>",
  };
  function emptyState(stateEl, gridEl, kind) {
    gridEl.innerHTML = '';
    const conf = {
      login:   { art: 'login', t: '還沒有登入', d: '用抖音或番茄 App 掃一下，書架就會出現在這裡', btn: '立即登入', run: () => $('#btnLogin').click() },
      empty:   { art: 'book',  t: '書架是空的', d: '在番茄裡收藏幾本，這裡就會同步過來',     btn: '重新整理', run: loadShelf },
      offline: { art: 'wifi',  t: '連不上電腦', d: '請確認電腦端的魔芋一夏還開著，兩台在同一個 Wi-Fi', btn: '重試', run: loadShelf },
    }[kind] || { art: 'book', t: kind, d: '', btn: '重試', run: loadShelf };

    stateEl.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 64 64" class="empty-art">${ART[conf.art]}</svg>
        <b>${conf.t}</b>
        <span>${conf.d}</span>
        <button class="empty-btn">${conf.btn}</button>
        <button class="empty-link">或貼上書號開書</button>
      </div>`;
    stateEl.querySelector('.empty-btn').addEventListener('click', conf.run);
    stateEl.querySelector('.empty-link').addEventListener('click', () => {
      document.querySelector('.tab[data-tab="search"]').click();
      setTimeout(() => $('#q').focus(), 120);
    });
  }

  async function loadShelf() {
    const grid = $('#shelfGrid'), state = $('#shelfState');
    state.textContent = '讀取中…';
    try {
      const r = await api('/api/shelf');
      if (!r.ok) {
        const offline = /連線|fetch|network|timeout/i.test(r.error || '');
        emptyState(state, grid, offline ? 'offline' : 'login');
        return;
      }
      st.shelf = r.books || [];
      if (!st.shelf.length) { emptyState(state, grid, 'empty'); return; }
      state.textContent = '';
      grid.innerHTML = st.shelf.map((b, i) => `
        <div class="bk" data-i="${i}">
          <div class="cv">
            ${b.cover ? `<img src="${esc(b.cover)}" loading="lazy" alt="">` : `<span class="ph">${esc(b.title || '')}</span>`}
          </div>
          <div class="nm">${esc(b.title || '')}</div>
          <div class="sb">${esc(b.chapterTitle || '未開始')}</div>
        </div>`).join('');
      grid.querySelectorAll('.bk').forEach((el) => {
        el.addEventListener('click', () => openBook(st.shelf[+el.dataset.i]));
      });
    } catch (e) {
      emptyState(state, grid, 'offline');
    }
  }

  /* ── 開書 ── */
  async function openBook(item) {
    page('reader');
    $('#rBody').innerHTML = '<p style="color:#999">載入中…</p>';
    $('#rTitle').textContent = item.title || '';
    try {
      const r = await post('/api/open', { input: item.id });
      st.book = r.book;
      st.chapters = r.book.chapters || [];
      const saved = st.shelf.find((x) => x.id === item.id);
      let idx = 0;
      if (saved && saved.chapterId) {
        const i = st.chapters.findIndex((c) => c.id === saved.chapterId);
        if (i >= 0) idx = i;
      }
      await goChapter(idx);
    } catch (e) {
      $('#rBody').innerHTML = '<p style="color:#999">這本書打不開：' + esc(e.message) + '</p>';
    }
  }

  async function goChapter(i) {
    if (!st.chapters.length) return;
    i = Math.max(0, Math.min(st.chapters.length - 1, i));
    st.index = i;
    const c = st.chapters[i];
    $('#rTitle').textContent = c.title;
    $('#rPos').textContent = `${i + 1} / ${st.chapters.length}`;
    const body = $('#rBody');
    try {
      const r = await api(`/api/chapter?book=${encodeURIComponent(st.book.id)}&id=${encodeURIComponent(c.id)}`);
      if (r.error) throw new Error(r.error);
      body.innerHTML = `<h2>${esc(c.title)}</h2>` +
        r.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('');
      body.scrollTop = 0;
      applyType();
      saveProgress(c);
    } catch (e) {
      body.innerHTML = `<p>${esc(e.message)}</p>`;
    }
  }

  function saveProgress(c) {
    post('/api/progress', {
      lastBook: st.book.id,
      books: { [st.book.id]: { chapterId: c.id, chapterNo: c.no, title: st.book.title, updated: Date.now() } },
    }).catch(() => {});
  }

  /* ── 閱讀器控制 ── */
  function page(which) {
    $('#reader').hidden = which !== 'reader';
    $('#tabbar').style.display = which === 'reader' ? 'none' : '';
    if (which === 'reader') applyReaderTheme();
  }
  document.getElementById('rBack').addEventListener('click', () => {
    page('shelf'); loadShelf();
  });
  $('#rPrev').addEventListener('click', () => goChapter(st.index - 1));
  $('#rNext').addEventListener('click', () => goChapter(st.index + 1));

  $('#rBody').addEventListener('click', (e) => {
    const w = window.innerWidth;
    const x = e.clientX;
    if (x < w * 0.28) goChapter(st.index - 1);
    else if (x > w * 0.72) goChapter(st.index + 1);
    else $('#reader').classList.toggle('immersive');
  });

  /* ── 目錄 ── */
  $('#rToc').addEventListener('click', () => {
    const d = $('#toc');
    d.hidden = false;
    const list = $('#tocList');
    const paint = (q) => {
      list.innerHTML = st.chapters
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => !q || (c.title || '').includes(q))
        .map(({ c, i }) => `<div class="dl${i === st.index ? ' on' : ''}" data-i="${i}">
            <span>${esc(c.title)}</span></div>`).join('');
      list.querySelectorAll('.dl').forEach((el) => el.addEventListener('click', () => {
        d.hidden = true;
        goChapter(+el.dataset.i);
      }));
    };
    paint('');
    $('#tocQ').value = '';
    $('#tocQ').oninput = (e) => paint(e.target.value.trim());
  });
  $('#tocClose').addEventListener('click', () => { $('#toc').hidden = true; });

  /* ── 字體面板 ── */
  function applyType() {
    const b = $('#rBody');
    b.style.fontSize = st.font + 'px';
    b.style.lineHeight = st.lh;
    b.style.setProperty('--gap', st.gap + 'px');
  }
  function applyReaderTheme() {
    const r = $('#reader');
    r.className = 'reader ' + (st.bg === 'paper' ? '' : st.bg);
    document.querySelectorAll('#fsBg i').forEach((i) => i.classList.toggle('on', i.dataset.bg === st.bg));
  }
  $('#rFont').addEventListener('click', () => {
    const f = $('#fontSheet');
    f.hidden = !f.hidden;
    if (!f.hidden) {
      $('#fsSize').value = st.font; $('#fsSizeV').textContent = st.font;
      $('#fsLh').value = st.lh; $('#fsLhV').textContent = st.lh.toFixed(1);
      applyReaderTheme();
    }
  });
  $('#fsSize').addEventListener('input', (e) => {
    st.font = +e.target.value; $('#fsSizeV').textContent = st.font;
    localStorage.setItem('m.font', st.font); applyType();
  });
  $('#fsLh').addEventListener('input', (e) => {
    st.lh = +e.target.value; $('#fsLhV').textContent = st.lh.toFixed(1);
    localStorage.setItem('m.lh', st.lh); applyType();
  });
  $('#fsBg').addEventListener('click', (e) => {
    const i = e.target.closest('i'); if (!i) return;
    st.bg = i.dataset.bg; localStorage.setItem('m.bg', st.bg); applyReaderTheme();
  });
  document.addEventListener('click', (e) => {
    const f = $('#fontSheet');
    if (f.hidden) return;
    if (!f.contains(e.target) && e.target.id !== 'rFont') f.hidden = true;
  });

  /* ── 搜尋 ── */
  const q = $('#q');
  q.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const v = q.value.trim();
    if (!v) return;
    const list = $('#searchList'), state = $('#searchState');
    if (/^\d{6,}$/.test(v) || /fanqienovel\.com/.test(v)) {
      state.textContent = '開啟中…';
      try {
        const r = await post('/api/open', { input: v });
        state.textContent = '開啟：' + r.book.title;
        openBook({ id: r.book.id, title: r.book.title });
      } catch (err) { state.textContent = '失敗：' + err.message; }
      return;
    }
    state.textContent = '書名搜尋還沒接上，請貼書號或書頁網址。';
    list.innerHTML = '';
  });

  /* ── 掃碼登入 ── */
  $('#btnLogin').addEventListener('click', async () => {
    const m = $('#qrModal'); m.hidden = false;
    const box = $('#qrBox'), tip = $('#qrTip');
    box.innerHTML = '<span style="color:#999;font-size:13px">產生中…</span>';
    try {
      const r = await post('/api/qr/start', {});
      box.innerHTML = `<img src="${r.image}" alt="QR">`;
      tip.textContent = '用抖音或番茄 App 掃描';
      const tick = async () => {
        try {
          const p = await api('/api/qr/poll?token=' + encodeURIComponent(r.token));
          if (p.status === 'confirmed') {
            tip.textContent = '登入成功';
            setTimeout(() => { m.hidden = true; loadShelf(); }, 800);
            return;
          }
          if (p.status === 'expired') { tip.textContent = 'QR 過期，請重開'; return; }
        } catch {}
        setTimeout(tick, 2000);
      };
      setTimeout(tick, 1500);
    } catch (e) { tip.textContent = '產生失敗：' + e.message; }
  });
  $('#qrClose').addEventListener('click', () => { $('#qrModal').hidden = true; });

  /* ── 我的 ── */
  async function loadMe() {
    try {
      const c = await api('/api/config');
      $('#meLogin').textContent = c.loggedIn ? '已登入' : '未登入';
    } catch { $('#meLogin').textContent = '—'; }
    try {
      const s = await api('/api/stats');
      const h = Math.floor((s.today?.seconds || 0) / 3600);
      const m2 = Math.round(((s.today?.seconds || 0) % 3600) / 60);
      $('#meTime').textContent = h ? `${h}h${m2}m` : `${m2}m`;
      $('#meChapters').textContent = (s.today?.chapters || 0) + ' 章';
    } catch {}
    try {
      const v = await api('/api/version');
      $('#meVer').textContent = v.sha || '—';
    } catch {}
  }
  $('#meSync').addEventListener('click', async () => {
    try {
      const p = await post('/api/sync/push', {});
      const l = await post('/api/sync/pull', {});
      alert(p.ok && l.ok ? `已同步：上傳 ${p.applied || 0}、下載 ${l.progress || 0}` : (p.error || l.error || '同步失敗'));
    } catch (e) { alert('同步失敗：' + e.message); }
  });
  $('#meClear').addEventListener('click', () => {
    localStorage.removeItem('m.font'); localStorage.removeItem('m.lh'); localStorage.removeItem('m.bg');
    alert('已清除本機設定');
  });

  /* ── 啟動 ── */
  applyType();
  loadShelf();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
