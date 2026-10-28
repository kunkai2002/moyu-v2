/* 魔芋一夏 · 手機版
   原則：
   1. 打開一本書只「讀」進度，絕不寫回（避免蓋掉真正的位置）
   2. 續讀順序：雲端進度 → 本機記住的章節 → 第 1 章
   3. 只有使用者動作（目錄跳章 / 自動接章 / 記住進度）才寫進度
   4. 目錄會標出「上次讀到」並自動捲到那一章 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var view = $('view'), titleEl = $('title');

  var TOKEN = (function () {
    var m = location.hash.match(/[#&]t=([^&]+)/);
    if (m) { try { localStorage.setItem('moyu.token', decodeURIComponent(m[1])); } catch (e) {} return decodeURIComponent(m[1]); }
    try { return localStorage.getItem('moyu.token') || ''; } catch (e) { return ''; }
  })();

  function api(p, opt) {
    opt = opt || {};
    return fetch(p, {
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
    loadedChapters: {},
  };

  var userGesture = false;   // 使用者真的滑了才允許自動接章
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

  /* 本機記住的章節：雲端被蓋掉時的保命符 */
  function rememberChapter(bookId, ch) {
    saveLocal('last:' + bookId, { id: ch.id, no: ch.no, title: ch.title || '' });
    try {
      var key = 'hist:' + bookId;
      var list = loadLocal(key, []) || [];
      list = list.filter(function (x) { return x.id !== ch.id; });
      list.unshift({ id: ch.id, no: ch.no, title: ch.title || '', at: Date.now() });
      saveLocal(key, list.slice(0, 8));
    } catch (e) {}
  }
  function historyOf(bookId) { return loadLocal('hist:' + bookId, []) || []; }
  function localChapter(bookId) { return loadLocal('last:' + bookId, null); }

  /* ── 主題 / 字級 ── */
  var theme = loadLocal('theme', 'dark') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  var font = Number(loadLocal('font', 17)) || 17;
  document.documentElement.style.setProperty('--fs', font + 'px');

  $('btnTheme').addEventListener('click', function () {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    saveLocal('theme', theme);
  });

  /* ── 進度顯示 ── */
  function progressOf(bookId) {
    var cloud = state.progress[bookId];
    var local = localChapter(bookId);
    if (cloud && cloud.chapter_no) {
      return { no: cloud.chapter_no, title: cloud.title || '', id: cloud.chapter_id };
    }
    if (local) return { no: local.no, title: local.title, id: local.id };
    return null;
  }

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
      card.setAttribute('data-book', b.id);
      var pr = progressOf(b.id);
      card.innerHTML = '<span class="t">' + esc(b.title || b.id) + '</span>'
        + '<span class="p">' + (pr ? '讀到 第 ' + esc(pr.no) + ' 章' : '未開始') + '</span>';
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
      var cached = loadLocal('shelf', []);
      if (cached && cached.length) { state.shelf = cached; renderShelf(); return; }
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

  /* ── 續讀定位：雲端 id → 雲端章號 → 本機 → 第 1 章 ── */
  function resolveIndex(bookId, chapters) {
    var cloud = state.progress[bookId];
    if (cloud) {
      if (cloud.chapter_id) {
        var i = chapters.findIndex(function (c) { return c.id === cloud.chapter_id; });
        if (i >= 0) return { index: i, from: 'cloud' };
      }
      if (cloud.chapter_no) {
        var j = chapters.findIndex(function (c) { return String(c.no) === String(cloud.chapter_no); });
        if (j >= 0) return { index: j, from: 'cloud-no' };
      }
    }
    var local = localChapter(bookId);
    if (local && local.id) {
      var k = chapters.findIndex(function (c) { return c.id === local.id; });
      if (k >= 0) return { index: k, from: 'local' };
    }
    return { index: 0, from: 'start' };
  }

  /* ── 開書：只讀進度，不寫回 ── */
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
    state.loadedChapters = {};
    userGesture = false;
    await loadMarks(bookId);

    var hit = resolveIndex(bookId, state.chapters);
    await readFrom(hit.index, { wipe: true, mark: false });
    var ch = state.chapters[hit.index];
    if (ch) rememberChapter(bookId, ch);
    if (hit.from !== 'start' && ch) {
      toast('已回到上次：第 ' + ch.no + ' 章');
    }
  }

  /* ── 標記 ── */
  async function loadMarks(bookId) {
    var r = await api('/api/marks?book=' + encodeURIComponent(bookId));
    state.marks = (r && r.marks) || [];
    saveLocal('marks:' + bookId, state.marks.filter(function (m) { return !m.deleted; }));
  }

  function paintMarks(box, chapterId) {
    var list = state.marks.filter(function (m) { return m.chapter_id === chapterId && !m.deleted; });
    var set = {};
    list.forEach(function (m) { set[Number(m.para)] = 1; });
    box.querySelectorAll('.p').forEach(function (p) {
      if (p.dataset.chapter !== chapterId) return;
      p.classList.toggle('marked', !!set[Number(p.dataset.para)]);
    });
  }

  /* ── 渲染 ── */
  function readFrom(index, opts) {
    opts = opts || {};
    state.index = index;
    $('btnBack').hidden = false;
    $('btnToc').hidden = false;
    $('remember').hidden = false;
    if (opts.wipe) {
      view.innerHTML = '<div class="read" id="readBox"></div>';
      state.loadedChapters = {};   // 清畫面就要清「已載入」，否則新章不會渲染
      userGesture = false;
      window.scrollTo(0, 0);
    }
    return appendChapter(index, opts);
  }

  async function appendChapter(index, opts) {
    opts = opts || {};
    var ch = state.chapters[index];
    if (!ch || state.busy) return;
    if (state.loadedChapters[ch.id]) return;
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
      state.busy = false;
      return;
    }

    if (box.querySelector('.chap')) {
      var sep = document.createElement('hr');
      sep.className = 'sep';
      box.appendChild(sep);
    }
    var h = document.createElement('div');
    h.className = 'chap';
    h.textContent = r.title || ch.title || ('第 ' + ch.no + ' 章');
    box.appendChild(h);

    (r.paragraphs || []).forEach(function (text, idx) {
      var p = document.createElement('p');
      p.className = 'p';
      p.textContent = text;
      p.dataset.para = String(idx);
      p.dataset.chapter = ch.id;
      p.addEventListener('click', function () { toggleMark(p); });
      box.appendChild(p);
    });

    paintMarks(box, ch.id);
    state.loadedChapters[ch.id] = true;
    state.index = index;
    titleEl.textContent = (r.title || ch.title || '').slice(0, 24);
    state.done = !!r.previewOnly || index >= state.chapters.length - 1;

    if (opts.mark) await saveProgress();

    if (r.previewOnly) {
      var note = document.createElement('div');
      note.className = 'preview';
      note.textContent = '這一章只取到試讀片段（付費章節）。';
      box.appendChild(note);
    }
    state.busy = false;
  }

  /* ── 只有使用者動作才寫進度 ── */
  async function saveProgress() {
    var ch = state.chapters[state.index];
    if (!state.book || !ch) return;
    rememberChapter(state.book.id, ch);
    var payload = {
      book_id: state.book.id,
      chapter_id: ch.id,
      chapter_no: ch.no,
      title: ch.title || '',
    };
    state.progress[state.book.id] = payload;
    var r = await api('/api/progress', { method: 'POST', body: payload });
    if (!r || r.ok === false) toast('進度同步失敗');
  }

  /* ── 劃線 ── */
  async function toggleMark(p) {
    var ch = state.chapters[state.index];
    if (!ch || !state.book) return;
    var chId = p.dataset.chapter || ch.id;
    var idx = Number(p.dataset.para);
    if (!Number.isFinite(idx)) return;
    var id = chId + '-' + idx + '-highlight';
    var had = p.classList.contains('marked');
    p.classList.toggle('marked', !had);
    var payload = had
      ? { action: 'remove', book_id: state.book.id, id: id }
      : {
        action: 'save', id: id, book_id: state.book.id, chapter_id: chId,
        chapter_title: ch.title || '', para: idx,
        text: (p.textContent || '').slice(0, 80), type: 'highlight',
      };
    await api('/api/marks', { method: 'POST', body: payload });
    var rr = await api('/api/marks?book=' + encodeURIComponent(state.book.id));
    state.marks = (rr && rr.marks) || [];
    paintMarks(p.parentElement, chId);
    toast(had ? '已取消劃線' : '已劃線');
  }

  /* ── 記住進度 ── */
  $('remember').addEventListener('click', async function () {
    if (!state.book) return;
    await saveProgress();
    var ch = state.chapters[state.index];
    toast('進度已記住：第 ' + (ch ? ch.no : '?') + ' 章');
  });

  /* ── 目錄：標出上次讀到 + 自動捲到當前 ── */
  function openToc() {
    var list = $('tocList');
    list.innerHTML = '';

    /* 最近讀過（就算雲端進度被蓋掉也能回來） */
    var hist = historyOf(state.book.id).slice(0, 5);
    if (hist.length) {
      var head = document.createElement('div');
      head.className = 'toc-sec';
      head.textContent = '最近讀過';
      list.appendChild(head);
      hist.forEach(function (h) {
        var i = state.chapters.findIndex(function (c) { return c.id === h.id; });
        if (i < 0) return;
        var b = document.createElement('button');
        b.className = 'toc-r toc-recent';
        b.innerHTML = '<span class="toc-no">' + esc(h.no) + '</span>'
          + '<span class="toc-t">' + esc((h.title || '').replace(/^第\s*\d+[章節]?\s*/, '')) + '</span>';
        b.addEventListener('click', function () { closeToc(); readFrom(i, { wipe: true, mark: true }); });
        list.appendChild(b);
      });
      var div = document.createElement('div');
      div.className = 'toc-sec';
      div.textContent = '全部章節';
      list.appendChild(div);
    }
    var pr = progressOf(state.book.id);
    var lastId = pr && pr.id ? pr.id : null;

    state.chapters.forEach(function (c, i) {
      var b = document.createElement('button');
      b.className = 'toc-r' + (i === state.index ? ' on' : '');
      var badge = (c.id === lastId) ? '<span class="toc-badge">上次讀到</span>' : '';
      b.innerHTML = '<span class="toc-no">' + esc(c.no) + '</span>'
        + '<span class="toc-t">' + esc((c.title || '').replace(/^第\s*\d+[章節]?\s*/, '')) + '</span>' + badge;
      b.addEventListener('click', function () {
        closeToc();
        readFrom(i, { wipe: true, mark: true });
      });
      list.appendChild(b);
    });

    $('toc').hidden = false;
    $('mask').hidden = false;
    setTimeout(function () {
      var cur = list.querySelector('.toc-r.on') || list.querySelector('.toc-r');
      if (cur) cur.scrollIntoView({ block: 'center' });
    }, 30);
  }
  function closeToc() { $('toc').hidden = true; $('mask').hidden = true; }
  $('btnToc').addEventListener('click', openToc);
  $('tocClose').addEventListener('click', closeToc);
  $('mask').addEventListener('click', closeToc);

  $('btnBack').addEventListener('click', function () {
    state.book = null;
    state.done = false;
    loadShelf();
  });

  /* ── 滾到底自動接下一章 ── */
  var lastY = 0;
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY;
      var down = y > lastY + 6;
      lastY = y;
      if (!down) return;
      var near = (window.innerHeight + y) >= (document.body.scrollHeight - 260);
      if (!near || state.busy || state.done || !state.book) return;
      if (!userGesture) return;          // 程式造成的捲動不算
      if (state.index >= state.chapters.length - 1) return;
      userGesture = false;               // 一次手勢只接一章
      readFrom(state.index + 1, { mark: true });
    });
  }
  ['touchstart', 'touchmove', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (state.book && !state.busy) userGesture = true;
    }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (state.book && /^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) userGesture = true;
  });
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── 啟動 ── */
  async function boot() {
    if (!TOKEN) {
      view.innerHTML = '<div class="token"><h2>需要配對</h2>'
        + '<p>在桌面版按頂欄的手機圖標，複製那條網址，用它在手機打開。</p>'
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
    if (cached && cached.length) state.shelf = cached;
    await loadProgress();
    await loadShelf();
  }

  boot();
})();
