/* 章節連讀：讀到底自動接下一章，章與章之間一條細線。
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
  ].join('\n');
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
    var keepTop = stream.scrollTop;      // 使用者正在看的位置
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
      // goChapter 會自動捲到底；這裡還原回去，讓讀的人自己決定速度
      requestAnimationFrame(function () { stream.scrollTop = keepTop; });
      setTimeout(function () { stream.scrollTop = keepTop; }, 80);
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
