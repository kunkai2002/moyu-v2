// 新增 ui/flow.js（章節連讀 + 章間細線）與 ui/remember.js（記住進度）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── ui/flow.js ───────────────────────────────────────────── */
{
  const src = `/* 章節連讀：讀到底自動接下一章，章與章之間一條細線。
   注意：付費章節（只有試讀）不再往下接，避免一路洗版。 */
(function () {
  'use strict';
  var D = window.__moyuDebug;
  var stream = document.querySelector('#stream');
  if (!D || !stream) return;
  var st = D.state;

  var css = document.createElement('style');
  css.textContent = [
    '#stream .chap-sep{border:0;border-top:1px solid var(--line);margin:26px 0 22px;opacity:.85}',
    '#stream .chap{position:relative}',
  ].join('\\n');
  document.head.appendChild(css);

  var busy = false;
  var blocked = false;          // 碰到試讀章節就停
  var ticker = null;

  function atBottom() {
    return stream.scrollHeight - stream.scrollTop - stream.clientHeight < 380;
  }

  function canAdvance() {
    if (busy || blocked) return false;
    if (!st.book || !st.chapters || !st.chapters.length) return false;
    if (st.index >= st.chapters.length - 1) return false;
    if (st.streaming) return false;          // 還在打字
    if (st.autoRead) return false;           // 自動閱讀自己會推進
    if (!atBottom()) return false;
    return true;
  }

  function lastBody() {
    var list = document.querySelectorAll('#stream .pb');
    return list.length ? list[list.length - 1] : null;
  }

  function advance() {
    if (!canAdvance()) return;
    busy = true;
    var thread = document.querySelector('#stream .thread');
    var before = thread ? thread.children.length : 0;
    D.goChapter(st.index + 1, { announce: false }).then(function () {
      var t = document.querySelector('#stream .thread');
      if (t && t.children.length > before) {
        var sep = document.createElement('hr');
        sep.className = 'chap-sep';
        t.insertBefore(sep, t.children[before]);
      }
      var body = lastBody();
      if (body && /試讀|免費範圍外/.test(body.textContent)) blocked = true;
      busy = false;
      setTimeout(advance, 60);
    }).catch(function () { busy = false; });
  }

  /* 滾到底 → 試著接下一章 */
  var queued = false;
  stream.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; advance(); });
  }, { passive: true });

  /* 內容變多（章節渲染完）也檢查一次：短章節不滾也能接 */
  var thread = document.querySelector('#stream .thread');
  if (thread && window.MutationObserver) {
    new MutationObserver(function () { setTimeout(advance, 120); })
      .observe(thread, { childList: true });
  }

  /* 保險：停在底部又閒著時，每 1.2 秒看一下 */
  ticker = setInterval(function () {
    if (canAdvance()) advance();
  }, 1200);

  window.__moyuFlow = {
    advance: advance,
    reset: function () { blocked = false; },
    get state() { return { blocked: blocked, busy: busy }; },
  };
})();
`;
  fs.writeFileSync(p('ui/flow.js'), src, 'utf8');
  console.log('ui/flow.js ok');
}

/* ── ui/remember.js ───────────────────────────────────────── */
{
  const src = `/* 記住進度：段落 hover 出現小圓球，右鍵也有選單。
   寫入本機進度 + 一筆位置標記，並立即推上雲端（有設定的話）。 */
(function () {
  'use strict';
  var D = window.__moyuDebug;
  var B = window.moyu;
  var stream = document.querySelector('#stream');
  if (!D || !B || !stream) return;
  var st = D.state;

  var css = document.createElement('style');
  css.textContent = [
    '.rm-ball{position:fixed;z-index:60;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;',
    '  background:var(--bg-elev);border:1px solid var(--line-strong);color:var(--fg2);cursor:pointer;',
    '  box-shadow:0 6px 18px rgba(0,0,0,.45);opacity:0;transform:scale(.9);pointer-events:none;',
    '  transition:opacity 140ms cubic-bezier(.2,.7,.3,1),transform 140ms cubic-bezier(.2,.7,.3,1),color 140ms}',
    '.rm-ball.on{opacity:1;transform:scale(1);pointer-events:auto}',
    '.rm-ball:hover{color:var(--acc);border-color:var(--acc)}',
    '.rm-ball svg{width:14px;height:14px}',
    '.rm-menu{position:fixed;z-index:61;min-width:132px;background:var(--bg-elev);border:1px solid var(--line-strong);',
    '  border-radius:8px;padding:4px;box-shadow:0 18px 50px rgba(0,0,0,.5);font-size:12px}',
    '.rm-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border-radius:5px;',
    '  color:var(--fg2);text-align:left}',
    '.rm-menu button:hover{background:var(--sel);color:var(--fg)}',
    '.rm-menu svg{width:14px;height:14px;flex:none}',
    '.rm-toast{position:fixed;left:50%;bottom:74px;transform:translate(-50%,8px);z-index:70;',
    '  background:var(--bg-elev);border:1px solid var(--line-strong);color:var(--fg2);border-radius:999px;',
    '  padding:6px 14px;font-size:12px;opacity:0;pointer-events:none;',
    '  transition:opacity 160ms ease,transform 160ms cubic-bezier(.2,.7,.3,1)}',
    '.rm-toast.on{opacity:1;transform:translate(-50%,0)}',
  ].join('\\n');
  document.head.appendChild(css);

  var icon = (window.MOYU_ICONS && window.MOYU_ICONS.svg) ? window.MOYU_ICONS.svg : function () { return ''; };

  var ball = document.createElement('button');
  ball.className = 'rm-ball';
  ball.title = '記住進度（本機 + 雲端）';
  ball.innerHTML = icon('bookmark', 14);
  document.body.appendChild(ball);

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

  function paraAt(el) {
    return el && el.closest ? el.closest('#stream .p') : null;
  }

  /* ── 小圓球跟著游標所在的段落 ── */
  stream.addEventListener('mousemove', function (e) {
    var p = paraAt(e.target);
    if (!p) return;
    currentPara = p;
    var r = p.getBoundingClientRect();
    var left = Math.min(r.right + 8, window.innerWidth - 34);
    ball.style.left = left + 'px';
    ball.style.top = Math.min(Math.max(r.top + 2, 8), window.innerHeight - 34) + 'px';
    ball.classList.add('on');
  }, { passive: true });

  stream.addEventListener('mouseleave', function () {
    ball.classList.remove('on');
    currentPara = null;
  });

  /* ── 右鍵選單 ── */
  var menu = document.createElement('div');
  menu.className = 'rm-menu';
  menu.hidden = true;
  menu.innerHTML = '<button id="rmMenuSave">' + icon('bookmark', 14) + '<span>記住進度</span></button>';
  document.body.appendChild(menu);

  function closeMenu() { menu.hidden = true; }

  stream.addEventListener('contextmenu', function (e) {
    var p = paraAt(e.target);
    if (!p) return;
    if (!st.book) return;
    e.preventDefault();
    currentPara = p;
    menu.hidden = false;
    var w = menu.offsetWidth || 140;
    menu.style.left = Math.min(e.clientX, window.innerWidth - w - 10) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 54) + 'px';
  });

  document.addEventListener('click', function (e) {
    if (!menu.hidden && !menu.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', closeMenu, true);

  async function remember(para) {
    if (!st.book || !st.chapters || !st.chapters.length) { say('先開一本書'); return; }
    var ch = st.chapters[st.index];
    var parent = para && para.parentElement;
    var idx = parent ? Array.prototype.indexOf.call(parent.children, para) : 0;
    var text = (para ? para.textContent : '').trim().slice(0, 80);
    var now = Date.now();

    /* 1. 本機進度 */
    try {
      var prog = (await B.progress.get()) || {};
      prog.books = prog.books || {};
      prog.lastBook = st.book.id;
      prog.books[st.book.id] = {
        chapterId: ch.id, chapterNo: ch.no, title: ch.title, updated: now, para: idx,
      };
      await B.progress.set(prog);
      st.progress = prog;
    } catch (e) { say('本機進度寫入失敗：' + e.message); return; }

    /* 2. 位置標記（會跟其他標記一起同步） */
    try {
      await B.marks.save({
        bookId: st.book.id, chapterId: ch.id, chapterTitle: ch.title,
        para: idx, text: text, type: 'pos',
      });
    } catch (e) { /* 標記失敗不擋進度 */ }

    /* 3. 雲端 */
    var cloud = '雲端未設定';
    try {
      var s = await B.sync.status();
      if (s && s.configured) {
        var r = await B.sync.push();
        cloud = (r && r.ok) ? '已上傳雲端' : ('雲端失敗：' + ((r && r.error) || '未知'));
      }
    } catch (e) { cloud = '雲端失敗：' + e.message; }

    say('進度已記住 · ' + cloud);
    ball.classList.add('on');
  }

  ball.addEventListener('click', function (e) {
    e.stopPropagation();
    if (currentPara) remember(currentPara);
  });

  menu.querySelector('#rmMenuSave').addEventListener('click', function (e) {
    e.stopPropagation();
    closeMenu();
    if (currentPara) remember(currentPara);
  });

  window.__moyuRemember = {
    save: function () { return currentPara ? remember(currentPara) : Promise.resolve(); },
    setPara: function (el) { currentPara = el; },
  };
})();
`;
  fs.writeFileSync(p('ui/remember.js'), src, 'utf8');
  console.log('ui/remember.js ok');
}

/* ── index.html 掛上去 ───────────────────────────────────── */
{
  const f = p('ui/index.html');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('src="flow.js"')) {
    must(s, '<script src="polish.js"></script>', 'index polish script');
    s = s.replace('<script src="polish.js"></script>',
      '<script src="polish.js"></script>\n<script src="flow.js"></script>\n<script src="remember.js"></script>');
    fs.writeFileSync(f, s, 'utf8');
    console.log('index.html ok');
  } else console.log('index.html 已含 flow.js');
}

/* ── pack4.js ─────────────────────────────────────────────── */
{
  const f = p('tools/pack4.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("'ui/flow.js'")) {
    must(s, "'ui/polish.js'", 'pack polish');
    s = s.replace("'ui/polish.js'", "'ui/polish.js', 'ui/flow.js', 'ui/remember.js'");
    fs.writeFileSync(f, s, 'utf8');
    console.log('pack4.js ok');
  } else console.log('pack4.js 已含 flow.js');
}
