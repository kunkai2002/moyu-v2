/* 魔芋一夏 · 手機鏡像（對話流，不是閱讀器）
   ─────────────────────────────────────────────────────────────
   結構照抄 AI 工具：每一本書＝一個工作階段；一章＝使用者一句「讀第 N 章」＋助手長回覆；
   段落之間插假 diff。沒有金鑰＝遊客模式（示例資料，只讀）；有金鑰＝真資料。
   進度只在使用者動作（翻章／記住進度）時寫回，打開一本書不會蓋掉桌面版的位置。 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var view = $('view'), titleEl = $('title');

  var TOKEN = (function () {
    var m = location.hash.match(/[#&]t=([^&]+)/);
    if (m) { try { localStorage.setItem('moyu.token', decodeURIComponent(m[1])); } catch (e) {} return decodeURIComponent(m[1]); }
    try { return localStorage.getItem('moyu.token') || ''; } catch (e) { return ''; }
  })();
  var GUEST = !TOKEN;

  function api(p, opt) {
    opt = opt || {};
    return fetch(p, {
      method: opt.method || 'GET',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
    });
  }

  /* ── 遊客模式的示例資料 ── */
  var DEMO_BOOKS = [
    { id: 'demo-1', title: '示例書：山門外的帳房' },
    { id: 'demo-2', title: '示例書：夜市燈下的約定' },
    { id: 'demo-3', title: '示例書：北方港口的春天' }
  ];
  var DEMO_CHAPTERS = [];
  for (var d = 1; d <= 8; d++) DEMO_CHAPTERS.push({ id: 'demo-c' + d, no: d, title: '第 ' + d + ' 章 ' + ['起程', '舊賬', '夜談', '山路', '回信', '渡口', '冬雪', '收燈'][d - 1] });
  var DEMO_TEXT = [
    '這是遊客預覽用的示例章節，文字只為了看清楚排版，不是任何一本真的書。',
    '每一章在畫面上長成助手的一段回覆：上面一行 ● 角色行，下面是正文。',
    '字級、行距可以用右上角的 A 按鈕調整；圓形按鈕切換深色淺色。',
    '段落中間會穿插假的「已更新檔案」與 diff，那是偽裝，不是真的程式碼。',
    '滾到最底下會自動接下一章，跟桌面版一樣。',
    '想要自己的書與進度，請改用桌面版產生的那條帶金鑰的網址。'
  ];

  var S = {
    books: [], chapters: [], book: null, index: 0, progress: {},
    loaded: {}, busy: false, done: false, guest: GUEST
  };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function save(k, v) { try { localStorage.setItem('moyu.m.' + k, JSON.stringify(v)); } catch (e) {} }
  function load(k, d) { try { var v = localStorage.getItem('moyu.m.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }

  var toastEl = $('toast'), toastTimer = null;
  function toast(t) {
    toastEl.textContent = t;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1700);
  }

  /* ── 主題 / 字級 ── */
  var theme = load('theme', 'dark') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  var font = Number(load('font', 16)) || 16;
  function paintFont() {
    document.documentElement.style.setProperty('--fs', font + 'px');
    $('fzVal').textContent = String(font);
  }
  function setFont(v) {
    font = Math.max(13, Math.min(24, Math.round(Number(v) || 16)));
    save('font', font);
    paintFont();
  }
  paintFont();
  $('btnTheme').addEventListener('click', function () {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    save('theme', theme);
  });
  var fz = $('fz');
  $('btnFont').addEventListener('click', function (e) { e.stopPropagation(); fz.hidden = !fz.hidden; });
  $('fzMinus').addEventListener('click', function (e) { e.stopPropagation(); setFont(font - 1); });
  $('fzPlus').addEventListener('click', function (e) { e.stopPropagation(); setFont(font + 1); });
  document.addEventListener('click', function (e) {
    if (fz.hidden) return;
    if (fz.contains(e.target) || $('btnFont').contains(e.target)) return;
    fz.hidden = true;
  });

  /* ── 假 diff（終端風的關鍵細節） ── */
  var FILES = ['src/gateway/report.ts', 'src/routes/portal.ts', 'web/src/App.tsx', 'src/lib/query.ts'];
  function diffBlock(n) {
    var f = FILES[n % FILES.length];
    var box = document.createElement('div');
    box.className = 'diff';
    box.innerHTML = '<div class="dh"><i></i>updated ' + f + '</div>'
      + '<pre class="db"><span class="ln">@@ -' + (140 + n) + ',7 +' + (140 + n) + ',9 @@</span>\n'
      + '<span class="ctx">  export async function buildReport(ctx: Ctx) {</span>\n'
      + '<span class="del">- const total = rows.length;</span>\n'
      + '<span class="add">+ const total = rows.reduce((s, r) => s + (r.amount || 0), 0);</span>\n'
      + '<span class="ctx">  }</span></pre>';
    return box;
  }

  /* ── 清單（書架＝工作階段清單） ── */
  function renderList() {
    $('btnBack').hidden = true;
    $('btnToc').hidden = true;
    $('btnFont').hidden = true;
    $('fz').hidden = true;
    $('remember').hidden = true;
    titleEl.textContent = S.guest ? '遊客預覽' : '工作階段';

    var head = document.createElement('div');
    head.className = 'sess-h';
    head.innerHTML = S.guest
      ? '<b>遊客預覽</b><span>示例資料，不連任何帳號</span>'
      : '<b>最近</b><span>' + S.books.length + ' 個工作階段</span>';

    var wrap = document.createElement('div');
    wrap.className = 'sess';

    if (!S.books.length) {
      wrap.innerHTML = '<div class="empty">還沒有書。在桌面版按「掃碼登入」，這裡就會出現。</div>';
    }
    S.books.forEach(function (b) {
      var pr = S.progress[b.id];
      var row = document.createElement('button');
      row.className = 'sess-r';
      row.innerHTML = '<span class="sr-t">' + esc(b.title || b.id) + '</span>'
        + '<span class="sr-p">' + (pr && pr.chapter_no ? '第 ' + esc(pr.chapter_no) + ' 章' : '未開始') + '</span>';
      row.addEventListener('click', function () { openBook(b); });
      wrap.appendChild(row);
    });

    view.innerHTML = '';
    view.appendChild(head);
    view.appendChild(wrap);
  }

  /* ── 對話流 ── */
  function turnUser(text) {
    var row = document.createElement('div');
    row.className = 'turn user';
    row.innerHTML = '<span class="bub">' + esc(text) + '</span>';
    return row;
  }
  function turnAI() {
    var row = document.createElement('div');
    row.className = 'turn ai';
    row.innerHTML = '<div class="gut">●</div><div class="bb"></div>';
    return row;
  }

  function openBook(b) {
    S.book = { id: b.id, title: b.title };
    S.chapters = S.guest ? DEMO_CHAPTERS.slice() : [];
    $('btnBack').hidden = false;
    $('btnToc').hidden = false;
    $('btnFont').hidden = false;
    $('remember').hidden = false;
    if (S.guest) {
      view.innerHTML = '<div class="chat" id="chat"></div>';
      readFrom(0, true);
      return;
    }
    view.innerHTML = '<div class="empty">讀取目錄…</div>';
    loadBook(b);
  }

  async function loadBook(b) {
    var r = await api('/api/open?input=' + encodeURIComponent(b.id));
    if (!r || r.ok === false) {
      view.innerHTML = '<div class="empty">' + esc((r && r.error) || '開書失敗') + '</div>';
      return;
    }
    S.chapters = (r.book && r.book.chapters) || [];
    view.innerHTML = '<div class="chat" id="chat"></div>';
    readFrom(resolveIndex(b.id), true);
  }

  function resolveIndex(bookId) {
    var pr = S.progress[bookId];
    if (pr && pr.chapter_id) {
      var i = S.chapters.findIndex(function (c) { return c.id === pr.chapter_id; });
      if (i >= 0) return i;
    }
    var local = load('last:' + bookId, null);
    if (local && local.id) {
      var j = S.chapters.findIndex(function (c) { return c.id === local.id; });
      if (j >= 0) return j;
    }
    return 0;
  }

  async function readFrom(i, wipe) {
    if (S.busy) return;
    var ch = S.chapters[i];
    if (!ch) return;
    S.index = i;
    var chat = $('chat');
    if (!chat) return;

    chat.appendChild(turnUser('讀《' + (S.book && S.book.title ? S.book.title : '') + '》第 ' + ch.no + ' 章'));
    var ai = turnAI();
    chat.appendChild(ai);
    var box = ai.querySelector('.bb');
    if (wipe) window.scrollTo(0, 0);

    if (S.guest) {
      paintChapter(box, ch, DEMO_TEXT.slice(), i);
      return;
    }

    S.busy = true;
    var loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = '讀取中…';
    box.appendChild(loading);
    var r = await api('/api/chapter?book=' + encodeURIComponent(S.book.id) + '&id=' + encodeURIComponent(ch.id));
    loading.remove();
    S.busy = false;
    if (!r || r.ok === false) {
      var e = document.createElement('div');
      e.className = 'err';
      e.textContent = (r && r.error) || '這一章讀不到';
      box.appendChild(e);
      return;
    }
    paintChapter(box, ch, r.paragraphs || [], i, r.title, r.previewOnly);
    if (r.title) titleEl.textContent = String(r.title).slice(0, 20);
  }

  function paintChapter(box, ch, paras, idx, title, previewOnly) {
    var h = document.createElement('div');
    h.className = 'chap';
    h.textContent = title || ch.title || ('第 ' + ch.no + ' 章');
    box.appendChild(h);

    paras.forEach(function (t, k) {
      var p = document.createElement('p');
      p.className = 'p';
      p.textContent = t;
      p.addEventListener('click', function () { p.classList.toggle('marked'); });
      box.appendChild(p);
      if ((k + 1) % 6 === 0 && k < paras.length - 1) box.appendChild(diffBlock(k + 1));
    });

    var meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = '● assistant · ' + Number((paras.join('').length) || 0).toLocaleString() + ' tok · 第 ' + ch.no + ' 章';
    box.appendChild(meta);

    if (previewOnly) {
      var note = document.createElement('div');
      note.className = 'err';
      note.textContent = '這一章只取到試讀片段（付費章節）。';
      box.appendChild(note);
    }
    S.done = idx >= S.chapters.length - 1;
    S.loaded[ch.id] = true;
  }

  async function loadShelf() {
    if (S.guest) { S.books = DEMO_BOOKS.slice(); renderList(); return; }
    view.innerHTML = '<div class="empty">讀取中…</div>';
    var p = await api('/api/progress');
    var map = {};
    ((p && p.progress) || []).forEach(function (x) { map[x.book_id] = x; });
    S.progress = map;
    var r = await api('/api/shelf');
    if (!r || r.ok === false) {
      S.books = load('shelf', []) || [];
      renderList();
      return;
    }
    S.books = r.books || [];
    save('shelf', S.books);
    renderList();
  }

  /* ── 目錄 ── */
  function openToc() {
    var list = $('tocList');
    list.innerHTML = '';
    S.chapters.forEach(function (c, i) {
      var b = document.createElement('button');
      b.className = 'toc-r' + (i === S.index ? ' on' : '');
      b.innerHTML = '<span class="toc-no">' + c.no + '</span><span class="toc-t">'
        + esc(String(c.title || '').replace(/^第\s*\d+\s*章\s*/, '')) + '</span>';
      b.addEventListener('click', function () {
        closeToc();
        view.innerHTML = '<div class="chat" id="chat"></div>';
        readFrom(i, true);
      });
      list.appendChild(b);
    });
    $('toc').hidden = false;
    $('mask').hidden = false;
    setTimeout(function () {
      var cur = list.querySelector('.toc-r.on');
      if (cur) cur.scrollIntoView({ block: 'center' });
    }, 30);
  }
  function closeToc() { $('toc').hidden = true; $('mask').hidden = true; }

  $('btnToc').addEventListener('click', openToc);
  $('tocClose').addEventListener('click', closeToc);
  $('mask').addEventListener('click', closeToc);
  $('btnBack').addEventListener('click', function () { S.book = null; loadShelf(); });
  $('remember').addEventListener('click', async function () {
    if (S.guest) { toast('遊客模式不寫進度'); return; }
    var ch = S.chapters[S.index];
    if (!ch || !S.book) return;
    save('last:' + S.book.id, { id: ch.id, no: ch.no });
    await api('/api/progress', { method: 'POST', body: { book_id: S.book.id, chapter_id: ch.id, chapter_no: ch.no, title: ch.title || '' } });
    toast('進度已記住：第 ' + ch.no + ' 章');
  });

  /* ── 滾到底接下一章（一次手勢只接一章） ── */
  var lastY = 0, ticking = false, gesture = false;
  ['touchstart', 'touchmove', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (S.book && !S.busy) gesture = true; }, { passive: true });
  });
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY;
      var down = y > lastY + 6;
      lastY = y;
      if (!down || !gesture || S.busy || !S.book) return;
      if (window.innerHeight + y < document.body.scrollHeight - 260) return;
      gesture = false;
      if (S.done) return;
      readFrom(S.index + 1, false);
    });
  }, { passive: true });

  /* ── 啟動 ── */
  async function boot() {
    if (!S.guest && navigator.serviceWorker && window.isSecureContext) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    if (S.guest) {
      var bar = document.createElement('div');
      bar.className = 'guestbar';
      bar.textContent = '遊客預覽 · 示例資料（不連帳號）；要讀自己的書請用帶金鑰的網址';
      document.body.insertBefore(bar, view);
    }
    await loadShelf();
  }
  boot();
})();
