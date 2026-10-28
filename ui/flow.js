/* 章節連讀 v2：底部哨兵 + 點它也能接；碰到試讀自動停 */
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
  var armed = false;   // 使用者滾到底才允許自動接
  var blocked = false;
  var lastIndex = -1;
  var sentinel = null;
  var io = null;

  function lastBody() {
    var list = document.querySelectorAll('#stream .pb');
    return list.length ? list[list.length - 1] : null;
  }

  function atBottom() {
    return stream.scrollHeight - stream.scrollTop - stream.clientHeight < 420;
  }

  function canAdvance() {
    if (busy || blocked) return false;
    if (!st.book || !st.chapters || !st.chapters.length) return false;
    if (st.index >= st.chapters.length - 1) return false;
    if (st.streaming) return false;
    var body = lastBody();
    if (body && /讀取中/.test(body.textContent)) return false;
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
      advance(true);
    });
    thread.appendChild(sentinel);
    if (io) io.disconnect();
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
            if (armed || noScrollbar) advance(false);
          }
        }
      }, { root: stream, rootMargin: '240px' });
      io.observe(sentinel);
    }
  }

  var lastPaint = '';
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
    if (!manual) {
      if (!atBottom()) return;
      // 沒有滾動（內容比視窗短）時允許自動補齊；其餘要等使用者滾
      var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
      if (!armed && !noScrollbar) return;
    }
    busy = true;
    if (sentinel) { sentinel.className = 'flow-more busy'; sentinel.innerHTML = '<span>正在接下一章…</span>'; }
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
      // 保住閱讀位置，讓使用者自己決定速度
      requestAnimationFrame(function () { stream.scrollTop = keepTop; });
      setTimeout(function () { stream.scrollTop = keepTop; }, 80);
      sentinel = null;                 // 重新掛到新的結尾
      makeSentinel();
      paintSentinel();
      busy = false;
      armed = false;
      // 內容仍比視窗短就再補一章，否則停下等使用者滾
      setTimeout(function () {
        if (!canAdvance()) return;
        var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
        if (noScrollbar) advance(false);
      }, 220);
    }).catch(function () {
      busy = false;
      paintSentinel();
    });
  }

  /* 內容變動（新章渲染、換書）→ 重新掛哨兵 */
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

  /* 只有真的手勢才武裝：程式自己捲到底（例如接章後還原位置）不該觸發連鎖 */
  ['wheel', 'touchmove'].forEach(function (ev) {
    stream.addEventListener(ev, function () { if (atBottom()) armed = true; }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if (/^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) { if (atBottom()) armed = true; }
  });
  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) { armed = false; return; }
    if (armed && canAdvance()) advance(false);
  }, { passive: true });

  /* 人工換章時解除「試讀封鎖」 */
  setInterval(function () {
    if (lastIndex !== st.index) {
      if (lastIndex >= 0) blocked = false;
      lastIndex = st.index;
      sentinel = null;
    }
    if (!st.book || !st.chapters || !st.chapters.length) return;
    // 換書、重建 thread、首頁切換都可能讓哨兵掉隊，這裡補回來
    makeSentinel();
    paintSentinel();
  }, 900);

  makeSentinel();
  paintSentinel();

  window.__moyuFlow = {
    advance: advance,
    reset: function () { blocked = false; paintSentinel(); },
    get state() { return { blocked: blocked, busy: busy, index: st.index, sentinel: !!sentinel }; },
  };
})();
