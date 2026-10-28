/* 魔芋一夏 · 手機版
   書架 → 讀正文（無限接章）→ 劃線 / 記住進度，進度與桌面共用同一組 API */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var view = $('view'), titleEl = $('title');

  /* ── 金鑰：網址帶 #t=... 或之前存過 ── */
  var TOKEN = (function () {
    var m = location.hash.match(/[#&]t=([^&]+)/);
    if (m) { try { localStorage.setItem('moyu.token', m[1]); } catch (e) {} return decodeURIComponent(m[1]); }
    try { return localStorage.getItem('moyu.token') || ''; } catch (e) { return ''; }
  })();

  function api(path, opt) {
    opt = opt || {};
    return fetch(path, {
      method: opt.method || 'GET',
      headers: Object.assign({
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      }, opt.headers || {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
    });
  }

  var state = {
    shelf: [],
    book: null,
    chapters: [],
    index: 0,
    progress: {},
    marks: [],
    busy: false,
    done: false,
    font: 17,
  };

  /* ── 小工具 ── */
  var toastTimer = null;
  function toast(t) {
    var el = $('toast');
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 1800);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function saveLocal(k, v) { try { localStorage.setItem('moyu.m.' + k, JSON.stringify(v)); } catch (e) {} }
  function loadLocal(k, d) {
    try { var v = localStorage.getItem('moyu.m.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }

  /* ── 主題 / 字級 ── */
  var theme = loadLocal('theme', 'dark') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  state.font = Number(loadLocal('font', 17)) || 17;
  document.documentElement.style.setProperty('--fs', state.font + 'px');

  $('btnTheme').addEventListener('click', function () {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    saveLocal('theme', theme);
  });

  /* ── 書架 ── */
  function renderShelf() {
    $('btnBack').hidden = true;
    $('btnToc').hidden = true;
    $('remember').hidden = true;
    titleEl.textContent = '書架';

    if (!state.shelf.length) {
      view.innerHTML = '<div class="empty">書架是空的。<br>先在桌面版按「掃碼登入」，這裡就會出現。</div>';
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'shelf';
    state.shelf.forEach(function (b) {
      var card = document.createElement('button');
      card.className = 'card';
      var pr = state.progress[b.id] || {};
      card.innerHTML = '<span class="t">' + esc(b.title || b.id) + '</span>'
        + '<span class="p">' + (pr.chapter_no ? '第 ' + esc(pr.chapter_no) + ' 章'
          : (b.chapterTitle ? esc(b.chapterTitle) : '未開始')) + '</span>';
      card.addEventListener('click', function () { openBook(b.id); });
      wrap.appendChild(card);
    });
    view.innerHTML = '';
    view.appendChild(wrap);
  }

  async function loadShelf() {
    view.innerHTML = '<div class="empty">讀取書架…</div>';
    var r = await api('/api/shelf');
    if (!r || r.ok === false) {
      view.innerHTML = '<div class="empty">' + esc((r && r.error) || '書架讀不到') + '</div>';
      return;
    }
    state.shelf = r.books || [];
    saveLocal('shelf', state.shelf);
    renderShelf();
  }

  async function loadProgress() {
    var r = await api('/api/progress');
    if (r && r.progress) {
      var map = {};
      r.progress.forEach(function (p) { map[p.book_id] = p; });
      state.progress = map;
    }
  }

  /* ── 開書 ── */
  async function openBook(bookId) {
    titleEl.textContent = '載入中…';
    view.innerHTML = '<div class="empty">載入目錄…</div>';
    var r = await api('/api/open?input=' + encodeURIComponent(bookId));
    if (!r || r.ok === false) {
      view.innerHTML = '<div class="empty">' + esc((r && r.error) || '開書失敗') + '</div>';
      return;
    }
    state.book = r.book;
    state.chapters = r.book.chapters || [];
    state.done = false;
    saveLocal('book:' + bookId, state.book);

    var pr = state.progress[bookId];
    var idx = 0;
    if (pr && pr.chapter_id) {
      var i = state.chapters.findIndex(function (c) { return c.id === pr.chapter_id; });
      if (i > 0) idx = i;
    }
    await loadMarks(bookId);
    await readFrom(idx, true);
  }

  /* ── 正文 ── */
  async function loadMarks(bookId) {
    var r = await api('/api/marks?book=' + encodeURIComponent(bookId));
    state.marks = (r && r.marks) || [];
  }

  function paintMarks(box, chapterId) {
    var ps = box.querySelectorAll('.p');
    var list = state.marks.filter(function (m) { return m.chapter_id === chapterId && !m.deleted; });
    ps.forEach(function (p, i) {
      var hit = list.some(function (m) { return Number(m.para) === i; });
      p.classList.toggle('marked', hit);
    });
  }

  async function readFrom(index, reset) {
    state.index = index;
    $('btnBack').hidden = false;
    $('btnToc').hidden = false;
    $('remember').hidden = false;

    if (reset) {
      view.innerHTML = '<div class="read" id="readBox"></div>';
      view.scrollTop = 0;
      window.scrollTo(0, 0);
    }
    await appendChapter(index);
    saveProgress();
  }

  async function appendChapter(index) {
    var ch = state.chapters[index];
    if (!ch || state.busy) return;
    state.busy = true;
    var box = $('readBox');
    if (!box) { state.busy = false; return; }
    var loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = '第 ' + ch.no + ' 章 讀取中…';
    box.appendChild(loading);

    var r = await api('/api/chapter?book=' + encodeURIComponent(state.book.id)
      + '&id=' + encodeURIComponent(ch.id));
    loading.remove();

    if (!r || r.ok === false) {
      var err = document.createElement('div');
      err.className = 'preview';
      err.textContent = (r && r.error) || '這一章讀不到';
      box.appendChild(err);
      state.done = true;
      state.busy = false;
      return;
    }

    if (index > 0) {
      var sep = document.createElement('hr');
      sep.className = 'sep';
      box.appendChild(sep);
    }
    var h = document.createElement('div');
    h.className = 'chap';
    h.textContent = r.title || ch.title || ('第 ' + ch.no + ' 章');
    box.appendChild(h);

    (r.paragraphs || []).forEach(function (text) {
      var p = document.createElement('p');
      p.className = 'p';
      p.textContent = text;
      p.addEventListener('click', function () { toggleMark(p); });
      box.appendChild(p);
    });

    paintMarks(box, ch.id);

    if (r.previewOnly) {
      var note = document.createElement('div');
      note.className = 'preview';
      note.textContent = '這一章只取到試讀片段（付費章節）。';
      box.appendChild(note);
    }

    titleEl.textContent = (r.title || ch.title || '').slice(0, 24);
    state.busy = false;

    /* 章尾：還有下一章就記下來，滾到底自動接 */
    state.lastChapterId = ch.id;
    saveProgress();
    if (r.previewOnly) state.done = true;
  }

  function saveProgress() {
    var ch = state.chapters[state.index];
    if (!state.book || !ch) return;
    var payload = {
      book_id: state.book.id,
      chapter_id: ch.id,
      chapter_no: ch.no,
      title: ch.title || '',
    };
    state.progress[state.book.id] = payload;
    api('/api/progress', { method: 'POST', body: payload }).catch(function () {});
  }

  /* ── 劃線 ── */
  async function toggleMark(p) {
    var ch = state.chapters[state.index];
    if (!ch || !state.book) return;
    var box = p.parentElement;
    var idx = Array.prototype.indexOf.call(box.querySelectorAll('.p'), p);
    var id = ch.id + '-' + idx + '-highlight';
    var had = p.classList.contains('marked');
    p.classList.toggle('marked', !had);
    var payload = had
      ? { action: 'remove', book_id: state.book.id, id: id }
      : {
        action: 'save', id: id, book_id: state.book.id, chapter_id: ch.id,
        chapter_title: ch.title || '', para: idx,
        text: (p.textContent || '').slice(0, 80), type: 'highlight',
      };
    await api('/api/marks', { method: 'POST', body: payload });
    await loadMarks(state.book.id);
    toast(had ? '已取消劃線' : '已劃線');
  }

  /* ── 記住進度 ── */
  $('remember').addEventListener('click', async function () {
    if (!state.book) return;
    var ch = state.chapters[state.index];
    if (!ch) return;
    var r = await api('/api/progress', {
      method: 'POST',
      body: {
        book_id: state.book.id, chapter_id: ch.id,
        chapter_no: ch.no, title: ch.title || '',
      },
    });
    toast(r && r.ok !== false ? '進度已記住' : ('失敗：' + ((r && r.error) || '')));
  });

  /* ── 目錄 ── */
  function openToc() {
    var list = $('tocList');
    list.innerHTML = '';
    state.chapters.forEach(function (c, i) {
      var b = document.createElement('button');
      b.className = 'toc-r' + (i === state.index ? ' on' : '');
      b.textContent = '第 ' + c.no + ' 章 ' + (c.title || '').replace(/^第\s*\d+[章節]?\s*/, '');
      b.addEventListener('click', function () {
        closeToc();
        state.done = false;
        readFrom(i, true);
      });
      list.appendChild(b);
    });
    $('toc').hidden = false;
    $('mask').hidden = false;
  }
  function closeToc() { $('toc').hidden = true; $('mask').hidden = true; }
  $('btnToc').addEventListener('click', openToc);
  $('tocClose').addEventListener('click', closeToc);
  $('mask').addEventListener('click', closeToc);

  $('btnBack').addEventListener('click', function () {
    state.book = null;
    state.done = false;
    renderShelf();
  });

  /* ── 滾到底自動接下一章（一次只接一章） ── */
  var armed = false;
  window.addEventListener('scroll', function () {
    var near = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 420);
    if (!near) { armed = false; return; }
    if (!armed) { armed = true; return; }
    if (state.busy || state.done || !state.book) return;
    if (state.index >= state.chapters.length - 1) { state.done = true; return; }
    armed = false;
    state.index++;
    appendChapter(state.index);
  }, { passive: true });
  window.addEventListener('touchmove', function () {
    var near = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 420);
    if (near) armed = true;
  }, { passive: true });

  /* ── 啟動 ── */
  async function boot() {
    if (!TOKEN) {
      view.innerHTML = '<div class="token"><h2>需要配對</h2>'
        + '<p>在桌面版「設定 → 手機」按「複製手機網址」，用那個網址打開這一頁；'
        + '或直接貼上金鑰。</p>'
        + '<input id="tokIn" placeholder="貼上金鑰" spellcheck="false">'
        + '<button id="tokGo">確定</button></div>';
      $('tokGo').addEventListener('click', function () {
        var v = $('tokIn').value.trim();
        if (!v) return;
        try { localStorage.setItem('moyu.token', v); } catch (e) {}
        location.reload();
      });
      return;
    }
    $('remember').hidden = true;
    var cached = loadLocal('shelf', []);
    if (cached && cached.length) { state.shelf = cached; }
    await loadProgress();
    await loadShelf();
  }

  boot();
})();
