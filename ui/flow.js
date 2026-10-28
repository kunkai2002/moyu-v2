/* 章節連讀 v3
   - 底部哨兵：滑到底（或點它）接下一章
   - 手勢令牌：一次手勢最多接一章，絕不連鎖
   - 碰到試讀章節就停
   - 內容不滿一屏時自動補齊 */
(function () {
  'use strict';
  var D = window.__moyuDebug;
  var stream = document.querySelector('#stream');
  if (!D || !stream) return;
  var st = D.state;

  var css = document.createElement('style');
  css.textContent = [
    '#stream .chap-sep{border:0;border-top:1px solid var(--line);margin:26px 0 22px;opacity:.85}',
    '.flow-more{display:flex;align-items:center;gap:10px;margin:18px 0 26px;color:var(--fg3);',
    '  font-size:11.5px;cursor:pointer;user-select:none}',
    '.flow-more::before,.flow-more::after{content:"";flex:1;border-top:1px solid var(--line);opacity:.6}',
    '.flow-more span{padding:0 4px;white-space:nowrap}',
    '.flow-more:hover{color:var(--acc)}',
    '.flow-more.busy{cursor:default;color:var(--fg3)}',
    '.flow-more.stop{cursor:default}',
    '.flow-more.stop:hover{color:var(--fg3)}',
  ].join('\n');
  document.head.appendChild(css);

  var busy = false;
  var blocked = false;
  var gestureSeq = 0;   // 每次真實手勢 +1
  var usedSeq = 0;      // 已經用掉的手勢
  var lastIndex = -1;
  var sentinel = null;
  var io = null;
  var lastPaint = '';

  function lastBody() {
    var list = document.querySelectorAll('#stream .pb');
    return list.length ? list[list.length - 1] : null;
  }

  function atBottom() {
    return stream.scrollHeight - stream.scrollTop - stream.clientHeight < 420;
  }

  function noScrollbar() {
    return stream.scrollHeight <= stream.clientHeight + 4;
  }

  function rendered() {
    var b = lastBody();
    return !!b && !/讀取中/.test(b.textContent) && b.querySelectorAll('.p').length > 1;
  }

  function canAdvance() {
    if (busy || blocked) return false;
    if (!st.book || !st.chapters || !st.chapters.length) return false;
    if (st.index >= st.chapters.length - 1) return false;
    if (st.streaming) return false;
    if (!rendered()) return false;   // 本章還沒畫出來，先等
    return true;
  }

  function makeSentinel() {
    var thread = document.querySelector('#stream .thread');
    if (!thread) return;
    if (sentinel && sentinel.parentNode === thread && thread.lastElementChild === sentinel) return;
    if (sentinel && sentinel.parentNode === thread) { thread.appendChild(sentinel); return; }
    if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
    lastPaint = '';
    sentinel = document.createElement('div');
    sentinel.className = 'flow-more';
    sentinel.innerHTML = '<span>繼續往下，自動接下一章</span>';
    sentinel.addEventListener('click', function () {
      if (blocked) return;
      gestureSeq++;
      advance(true);
    });
    thread.appendChild(sentinel);
    if (io) io.disconnect();
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) advance(false);
        }
      }, { root: stream, rootMargin: '240px' });
      io.observe(sentinel);
    }
  }

  function paintSentinel() {
    if (!sentinel) return;
    var want;
    if (blocked) want = 'stop|這一章只有試讀，先停在這裡';
    else if (st.index >= st.chapters.length - 1) want = 'stop|已經是最後一章';
    else want = 'open|繼續往下，自動接下一章';
    if (want === lastPaint) return;
    lastPaint = want;
    var parts = want.split('|');
    sentinel.className = 'flow-more' + (parts[0] === 'stop' ? ' stop' : '');
    sentinel.innerHTML = '<span>' + parts[1] + '</span>';
  }

  function advance(manual) {
    if (!canAdvance()) { paintSentinel(); return; }
    var autoFill = noScrollbar();
    if (!manual) {
      if (!atBottom() && !autoFill) return;
      if (!autoFill && usedSeq >= gestureSeq) return;
      if (autoFill && usedSeq >= gestureSeq && busy) return;
    }
    busy = true;
    var usedAtStart = gestureSeq;
    if (sentinel) {
      sentinel.className = 'flow-more busy';
      sentinel.innerHTML = '<span>正在接下一章…</span>';
      lastPaint = 'busy';
    }
    var thread = document.querySelector('#stream .thread');
    var keepTop = stream.scrollTop;
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
      lastIndex = st.index;
      usedSeq = Math.max(usedSeq, usedAtStart);
      requestAnimationFrame(function () { stream.scrollTop = keepTop; });
      setTimeout(function () { stream.scrollTop = keepTop; }, 80);
      sentinel = null;
      makeSentinel();
      paintSentinel();
      busy = false;
      // 只有「內容還不滿一屏」才自動補下一章
      setTimeout(function () {
        if (!canAdvance()) return;
        if (noScrollbar()) advance(false);
      }, 240);
    }).catch(function () {
      busy = false;
      sentinel = null;
      makeSentinel();
      paintSentinel();
    });
  }

  /* 真實手勢：滾輪 / 觸控 / 鍵盤 */
  ['wheel', 'touchmove'].forEach(function (ev) {
    stream.addEventListener(ev, function () {
      if (atBottom()) gestureSeq++;
    }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if (/^(PageDown|ArrowDown|End|Down| )$/.test(e.key) && atBottom()) gestureSeq++;
  });

  /* 捲動只負責在「已有新手勢」時觸發，不自己製造手勢 */
  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) return;
    if (canAdvance()) advance(false);
  }, { passive: true });

  /* 觀察 #stream 的直接子節點（首頁/換書會重建 thread） */
  var threadEl = document.querySelector('#stream .thread');
  var mo = new MutationObserver(function () {
    makeSentinel();
    paintSentinel();
  });
  function observeThread(t) {
    if (!t || t === threadEl) return;
    threadEl = t;
    mo.disconnect();
    mo.observe(t, { childList: true });
    sentinel = null;
    makeSentinel();
    paintSentinel();
  }
  observeThread(threadEl);
  new MutationObserver(function () {
    observeThread(document.querySelector('#stream .thread'));
  }).observe(stream, { childList: true });

  /* 守護：換章、換書、首頁切換都補回哨兵 */
  setInterval(function () {
    if (lastIndex !== st.index) {
      if (lastIndex >= 0) blocked = false;
      lastIndex = st.index;
      sentinel = null;
      lastPaint = '';
    }
    if (!st.book || !st.chapters || !st.chapters.length) return;
    makeSentinel();
    paintSentinel();
  }, 900);

  makeSentinel();
  paintSentinel();

  window.__moyuFlow = {
    advance: advance,
    reset: function () { blocked = false; paintSentinel(); },
    get state() {
      return { blocked: blocked, busy: busy, index: st.index, gestureSeq: gestureSeq, usedSeq: usedSeq, sentinel: !!sentinel };
    },
  };
})();
