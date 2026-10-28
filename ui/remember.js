/* 段落右鍵選單：記住進度 / 劃線 / 筆記 / 複製 / 搜尋 */
(function () {
  'use strict';
  var D = window.__moyuDebug;
  var B = window.moyu;
  var stream = document.querySelector('#stream');
  if (!D || !B || !stream) return;
  var st = D.state;

  var css = document.createElement('style');
  css.textContent = [
    '.rm-menu{position:fixed;z-index:61;min-width:168px;background:var(--bg-elev);',
    '  border:1px solid var(--line-strong);border-radius:8px;padding:4px;',
    '  box-shadow:0 18px 46px rgba(0,0,0,.5);font-size:12px}',
    '.rm-menu[hidden]{display:none}',
    '.rm-menu .rm-head{padding:5px 8px 4px;color:var(--fg3);font-size:10.5px;',
    '  border-bottom:1px solid var(--line);margin-bottom:3px;overflow:hidden;',
    '  text-overflow:ellipsis;white-space:nowrap;max-width:240px}',
    '.rm-menu .rm-sep{height:1px;background:var(--line);margin:3px 2px}',
    '.rm-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;',
    '  border-radius:5px;color:var(--fg2);text-align:left}',
    '.rm-menu button:hover{background:var(--sel);color:var(--fg)}',
    '.rm-menu svg{width:14px;height:14px;flex:none}',
    '.rm-toast{position:fixed;left:50%;bottom:74px;transform:translate(-50%,8px);z-index:70;',
    '  background:var(--bg-elev);border:1px solid var(--line-strong);color:var(--fg2);',
    '  border-radius:999px;padding:6px 14px;font-size:12px;opacity:0;pointer-events:none;',
    '  transition:opacity 160ms ease,transform 160ms cubic-bezier(.2,.7,.3,1)}',
    '.rm-toast.on{opacity:1;transform:translate(-50%,0)}',
  ].join('\n');
  document.head.appendChild(css);

  var I = window.MOYU_ICONS;
  var icon = function (name, size) { return I ? I.svg(name, size || 14) : ''; };

  var toast = document.createElement('div');
  toast.className = 'rm-toast';
  document.body.appendChild(toast);

  var toastTimer = null;
  function say(text) {
    toast.textContent = text;
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('on'); }, 2200);
  }

  var currentPara = null;

  var menu = document.createElement('div');
  menu.className = 'rm-menu';
  menu.hidden = true;
  menu.innerHTML = ''
    + '<div class="rm-head" id="rmHead"></div>'
    + '<button id="rmSave">' + icon('bookmark') + '<span>記住進度</span></button>'
    + '<div class="rm-sep"></div>'
    + '<button id="rmMark">' + icon('note') + '<span id="rmMarkTxt">劃線</span></button>'
    + '<button id="rmNote">' + icon('note') + '<span>寫筆記…</span></button>'
    + '<div class="rm-sep"></div>'
    + '<button id="rmCopy">' + icon('copy') + '<span>複製這段</span></button>'
    + '<button id="rmSearch">' + icon('search') + '<span>全書搜尋這段</span></button>';
  document.body.appendChild(menu);

  var head = menu.querySelector('#rmHead');
  var markTxt = menu.querySelector('#rmMarkTxt');

  function closeMenu() { menu.hidden = true; }

  stream.addEventListener('contextmenu', function (e) {
    var p = e.target && e.target.closest ? e.target.closest('#stream .p') : null;
    if (!p || !st.book || !st.chapters || !st.chapters.length) return;
    e.preventDefault();
    currentPara = p;
    var ch = st.chapters[st.index];
    head.textContent = ch ? ('第 ' + ch.no + ' 章 · ' + ch.title) : '這一段';
    var marked = !!(window.__moyuMarks && window.__moyuMarks.isMarked(p));
    markTxt.textContent = marked ? '取消劃線' : '劃線';
    menu.hidden = false;
    var w = menu.offsetWidth || 176;
    var h = menu.offsetHeight || 180;
    menu.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth - w - 10)) + 'px';
    menu.style.top = Math.max(8, Math.min(e.clientY, window.innerHeight - h - 10)) + 'px';
  });

  document.addEventListener('click', function (e) {
    if (!menu.hidden && !menu.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', closeMenu, true);
  window.addEventListener('resize', closeMenu);

  /* ── 記住進度 ── */
  async function remember(para) {
    if (!st.book || !st.chapters || !st.chapters.length) { say('先開一本書'); return; }
    // 這一串文字屬於哪一章：看它自己所在的 .pb，不是「最後接進來的那一章」
    var box = (para && para.closest) ? para.closest('.pb') : null;
    var ci = box ? Number(box.dataset.ci) : NaN;
    var ch = (Number.isFinite(ci) && st.chapters[ci]) ? st.chapters[ci] : st.chapters[st.index];
    var parent = para && para.parentElement;
    var idx = parent ? Array.prototype.indexOf.call(parent.children, para) : 0;
    var text = (para ? para.textContent : '').trim().slice(0, 80);
    var now = Date.now();

    try {
      var prog = (await B.progress.get()) || {};
      prog.books = prog.books || {};
      prog.lastBook = st.book.id;
      prog.books[st.book.id] = {
        chapterId: ch.id, chapterNo: ch.no, title: ch.title, updated: now, para: idx,
      };
      await B.progress.set(prog);
      st.progress = prog;
      st.explicitProgressAt = Date.now();   // 這是使用者明確按的，捲動監看先讓開
    } catch (e) { say('本機進度寫入失敗：' + e.message); return; }

    try {
      await B.marks.save({
        bookId: st.book.id, chapterId: ch.id, chapterTitle: ch.title,
        para: idx, text: text, type: 'pos',
      });
    } catch (e) { /* 標記失敗不擋進度 */ }

    var cloud = '雲端未設定';
    try {
      var s = await B.sync.status();
      if (s && s.configured) {
        var r = await B.sync.push();
        cloud = (r && r.ok) ? '已上傳雲端' : ('雲端失敗：' + ((r && r.error) || '未知'));
      }
    } catch (e) { cloud = '雲端失敗：' + e.message; }

    say('進度已記住 · ' + cloud);
  }

  menu.querySelector('#rmSave').addEventListener('click', function (e) {
    e.stopPropagation(); closeMenu();
    if (currentPara) remember(currentPara);
  });

  /* ── 劃線 / 取消 ── */
  menu.querySelector('#rmMark').addEventListener('click', async function (e) {
    e.stopPropagation(); closeMenu();
    if (!currentPara || !window.__moyuMarks) return;
    var on = await window.__moyuMarks.toggle(currentPara);
    say(on ? '已劃線' : '已取消劃線');
  });

  /* ── 筆記 ── */
  menu.querySelector('#rmNote').addEventListener('click', async function (e) {
    e.stopPropagation(); closeMenu();
    if (!currentPara || !window.__moyuMarks) return;
    await window.__moyuMarks.note(currentPara);
  });

  /* ── 複製 ── */
  menu.querySelector('#rmCopy').addEventListener('click', async function (e) {
    e.stopPropagation(); closeMenu();
    var text = currentPara ? currentPara.textContent.trim() : '';
    if (!text) return;
    try {
      if (B.copyPlain) { await B.copyPlain(text); }
      else { await navigator.clipboard.writeText(text); }
      say('已複製');
    } catch (err) { say('複製失敗：' + err.message); }
  });

  /* ── 搜尋 ── */
  menu.querySelector('#rmSearch').addEventListener('click', function (e) {
    e.stopPropagation(); closeMenu();
    var text = currentPara ? currentPara.textContent.trim().slice(0, 24) : '';
    if (!text) return;
    if (D.searchInBook) D.searchInBook(text);
  });

  window.__moyuRemember = {
    save: function () { return currentPara ? remember(currentPara) : Promise.resolve(); },
    setPara: function (el) { currentPara = el; },
    openWith: function (el) { currentPara = el; menu.hidden = false; },
    get menuOpen() { return !menu.hidden; },
    get items() { return [...menu.querySelectorAll('button')].map(function (b) { return b.textContent.trim(); }); },
  };
})();
