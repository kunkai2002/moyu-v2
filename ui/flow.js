/* 章節連讀 v5
   2026-10-28 重寫（v4 還是有洞，這版把洞全堵掉）

   為什麼一直「一滑就跳章」：
   1. App 自己畫完一章會 scrollBottom()，那是程式碼在捲，不是使用者在捲。
      舊版把「scroll 事件」也當手勢，於是每畫完一章就自己接下一章。
   2. 章節快取命中時 IPC < 10ms，一次滑動的十幾個滾輪事件會各接一章
      （v3 的「一次手勢一個令牌」是每個事件 +1，不是每下滑 +1）。
   3. 舊版「快到尾巴」用固定 420px，小視窗（JOJO 的 565x505）整個閱讀區
      才 297px，等於永遠在「尾巴」。

   這一版的規則：
   A. 手勢只認真的輸入事件：滾輪向下 / 手指往上 / PageDown 等鍵。
      程式化捲動（scrollBottom、還原位置）永遠不會被當成手勢。
   B. 一次滑動 = 一次爆發：靜止 ≥ 340ms 之後才算下一次。
   C. 一次手勢最多接一章（爆發在載入前就先吃掉），載入多快都一樣。
   D. 必須真的在底部（誤差 24px），不是「接近」。
   E. 本章要畫完（沒在串流、有段落）才准接。
   F. 接完 900ms 冷卻；內容不滿一屏才自動補，一次最多補 2 章。
*/
(function () {
  'use strict';
  var D = window.__moyuDebug;
  var stream = document.querySelector('#stream');
  if (!D || !stream) return;
  var st = D.state;

  var css = document.createElement('style');
  css.textContent = [
    '#stream .chap-sep{border:0;border-top:1px solid var(--line);margin:26px 0 22px;opacity:.85}',
    /* 接續提示：只有一個圖示，沒有字（對話流裡的「往下」暗示） */
    '.flow-more{display:flex;align-items:center;justify-content:center;gap:10px;margin:16px 0 24px;',
    '  height:26px;color:var(--fg3);cursor:pointer;user-select:none}',
    '.flow-more::before,.flow-more::after{content:"";flex:1;border-top:1px solid var(--line);opacity:.55}',
    '.flow-more svg{flex:none;transition:transform 140ms ease}',
    '.flow-more:hover{color:var(--acc)}',
    '.flow-more:hover svg{transform:translateY(2px)}',
    '.flow-more.busy{cursor:default;color:var(--fg3)}',
    '.flow-more.stop{cursor:default}',
    '.flow-more.stop:hover{color:var(--fg3)}',
    '.flow-more.stop:hover svg{transform:none}',
    '.flow-spin{width:13px;height:13px;border-radius:50%;border:1.5px solid var(--line-strong);',
    '  border-top-color:var(--acc);animation:flowspin .9s linear infinite;display:inline-block}',
    '@keyframes flowspin{to{transform:rotate(360deg)}}',
  ].join('\n');
  document.head.appendChild(css);

  var ICON_DOWN = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 9.5 5.5 5.5 5.5-5.5"/></svg>';
  var ICON_END = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12"/></svg>';

  var BURST_GAP = 340;   // 兩次滑動之間的靜止時間（ms）
  var COOLDOWN = 900;    // 接完一章的冷卻（ms）
  var MAX_FILL = 2;      // 一次最多自動補幾章
  var BOTTOM_SLACK = 24; // 「真的在底部」容許誤差（px）

  var busy = false;
  var blocked = false;
  var burstId = 0;         // 手勢爆發序號：只有新的滑動才 +1
  var consumedBurst = 0;   // 已經被用掉的爆發
  var lastMoveAt = 0;
  var lastAdvanceAt = 0;
  var fillChain = 0;
  var lastIndex = -1;
  var sentinel = null;
  var lastPaint = '';

  function now() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }

  function lastBody() {
    var list = document.querySelectorAll('#stream .pb');
    return list.length ? list[list.length - 1] : null;
  }

  /* 真的在底部（不是「接近」） */
  function trueBottom() {
    return stream.scrollTop + stream.clientHeight >= stream.scrollHeight - BOTTOM_SLACK;
  }

  /* 本章畫完了、停了 */
  function settled() {
    if (st.streaming) return false;
    var b = lastBody();
    if (!b) return false;
    if (/讀取中/.test(b.textContent)) return false;
    return b.querySelectorAll('.p').length > 1;
  }

  function noScrollbar() {
    return stream.scrollHeight <= stream.clientHeight + 4;
  }

  function canAdvance(manual) {
    if (busy || blocked) return false;
    if (!st.book || !st.chapters || !st.chapters.length) return false;
    if (st.index >= st.chapters.length - 1) return false;
    if (!manual && !settled()) return false;
    return true;
  }

  /* 手勢爆發：靜止夠久才算是「新的一下滑」 */
  function newBurst() {
    var t = now();
    if (t - lastMoveAt > BURST_GAP) {
      burstId++;
      fillChain = 0;
    }
    lastMoveAt = t;
    return burstId;
  }

  /* 把舊的哨兵整個拿走：只留一個，不然接一章就多一個箭頭 */
  function dropSentinel() {
    if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
    sentinel = null;
    lastPaint = '';
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
    sentinel.title = '往下';
    sentinel.innerHTML = ICON_DOWN;
    sentinel.addEventListener('click', function () {
      if (blocked || busy) return;
      if (st.index >= st.chapters.length - 1) return;
      advance(true);
    });
    thread.appendChild(sentinel);
  }

  function paintSentinel() {
    if (!sentinel) return;
    var want;
    if (blocked) want = 'stop|已到可讀範圍';
    else if (st.index >= st.chapters.length - 1) want = 'stop|已到最後';
    else want = 'open|往下';
    if (want === lastPaint) return;
    lastPaint = want;
    var parts = want.split('|');
    sentinel.className = 'flow-more' + (parts[0] === 'stop' ? ' stop' : '');
    sentinel.title = parts[1];
    sentinel.innerHTML = parts[0] === 'stop' ? ICON_END : ICON_DOWN;
  }

  function advance(manual) {
    if (!canAdvance(manual)) { paintSentinel(); return; }
    var t = now();
    if (!manual) {
      if (consumedBurst >= burstId) return;      // 這一下手勢已經用掉
      if (t - lastAdvanceAt < COOLDOWN) return;  // 冷卻中
      if (!trueBottom()) return;                 // 還沒真的到底
    }
    /* 先把這次爆發吃掉再開始載入：載入再快也不會接第二章 */
    consumedBurst = burstId;
    lastAdvanceAt = t;
    busy = true;

    if (sentinel) {
      sentinel.className = 'flow-more busy';
      sentinel.title = '載入中';
      sentinel.innerHTML = '<span class="flow-spin"></span>';
      lastPaint = 'busy';
    }
    var thread = document.querySelector('#stream .thread');
    var keepTop = stream.scrollTop;
    var before = thread ? thread.children.length : 0;

    D.goChapter(st.index + 1, { announce: false, autoAppend: true }).then(function () {
      var tt = document.querySelector('#stream .thread');
      if (tt && tt.children.length > before) {
        var sep = document.createElement('hr');
        sep.className = 'chap-sep';
        tt.insertBefore(sep, tt.children[before]);
      }
      var body = lastBody();
      if (body && /試讀|免費範圍外/.test(body.textContent)) blocked = true;
      lastIndex = st.index;
      requestAnimationFrame(function () { stream.scrollTop = keepTop; });
      setTimeout(function () { stream.scrollTop = keepTop; }, 80);
      dropSentinel();
      makeSentinel();
      paintSentinel();
      busy = false;
      setTimeout(function () { tryFill(); }, 260);
    }).catch(function () {
      busy = false;
      dropSentinel();
      makeSentinel();
      paintSentinel();
    });
  }

  /* 內容不滿一屏才自動補章（有上限，且要畫完才補） */
  function tryFill() {
    if (!canAdvance(false)) return;
    if (!noScrollbar()) return;
    if (fillChain >= MAX_FILL) return;
    if (now() - lastAdvanceAt < COOLDOWN) return;
    burstId++;          // 自己發一次爆發，不跟真手勢混在一起
    fillChain++;
    advance(false);
  }

  /* ── 手勢來源 1：滾輪（真正的使用者輸入）── */
  stream.addEventListener('wheel', function (e) {
    if (blocked || busy) return;
    if (!(e.deltaY > 0)) return;             // 往上滾不是手勢
    newBurst();
    if (!trueBottom()) return;
    advance(false);
  }, { passive: true });

  /* ── 手勢來源 2：觸控（手指往上推＝往下讀）── */
  var touchStartY = 0;
  stream.addEventListener('touchstart', function (e) {
    touchStartY = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
  }, { passive: true });
  stream.addEventListener('touchmove', function (e) {
    if (blocked || busy) return;
    var y = e.touches && e.touches[0] ? e.touches[0].clientY : touchStartY;
    if (touchStartY - y <= 6) return;        // 手指往下＝往回讀
    newBurst();
    if (!trueBottom()) return;
    advance(false);
  }, { passive: true });

  /* ── 手勢來源 3：鍵盤（打字、面板開著都不算）── */
  function typingIn(e) {
    var t = e.target;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }
  function panelOpen() {
    return !!document.querySelector('.panel:not([hidden]), .marks-panel:not([hidden]), .stats-panel:not([hidden]), .detail:not([hidden]), .hist-panel:not([hidden]), .phone-panel:not([hidden]), .overflow:not([hidden])');
  }
  window.addEventListener('keydown', function (e) {
    if (typingIn(e) || panelOpen() || blocked || busy) return;
    if (!/^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) return;
    if (!trueBottom()) return;
    newBurst();
    advance(false);
  });

  /* 注意：這裡故意沒有 scroll 事件監聽。
     程式化捲動（畫完一章自動捲到底、還原閱讀位置）不是手勢，
     監聽 scroll 就是把「自己捲」當成「你在滑」，那正是跳章的來源。 */

  /* ── 觀察 thread 重建（首頁/換書）── */
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
    dropSentinel();
    makeSentinel();
    paintSentinel();
  }
  observeThread(threadEl);
  new MutationObserver(function () {
    observeThread(document.querySelector('#stream .thread'));
  }).observe(stream, { childList: true });

  /* ── 守護：換章、換書都補回哨兵 ── */
  setInterval(function () {
    if (lastIndex !== st.index) {
      if (lastIndex >= 0) blocked = false;
      lastIndex = st.index;
      dropSentinel();
    }
    if (!st.book || !st.chapters || !st.chapters.length) return;
    makeSentinel();
    paintSentinel();
  }, 900);

  makeSentinel();
  paintSentinel();

  window.__moyuFlow = {
    advance: advance,
    tryFill: tryFill,
    reset: function () { blocked = false; paintSentinel(); },
    get state() {
      return {
        blocked: blocked, busy: busy, index: st.index,
        burstId: burstId, consumedBurst: consumedBurst,
        gestureSeq: burstId, usedSeq: consumedBurst,   // 舊欄位，測試還在讀
        sentinel: !!sentinel, atEnd: trueBottom(), settled: settled(),
      };
    },
  };
})();
