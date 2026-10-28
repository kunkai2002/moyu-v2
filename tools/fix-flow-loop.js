// 修 flow.js：觀察 subtree 又改 innerHTML 會造成無限迴圈（畫面凍結）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const f = p('ui/flow.js');
let s = fs.readFileSync(f, 'utf8');

/* 1) paint 只在內容真的變了才動 DOM */
s = s.replace(
`  function paintSentinel() {
    if (!sentinel) return;`,
`  var lastPaint = '';
  function paintSentinel() {
    if (!sentinel) return;
    var want;`
);

s = s.replace(
`    if (blocked) {
      sentinel.className = 'flow-more stop';
      sentinel.innerHTML = '<span>這一章只有試讀，先停在這裡</span>';
    } else if (st.index >= st.chapters.length - 1) {
      sentinel.className = 'flow-more stop';
      sentinel.innerHTML = '<span>已經是最後一章</span>';
    } else {
      sentinel.className = 'flow-more';
      sentinel.innerHTML = '<span>繼續往下，自動接下一章</span>';
    }
  }`,
`    if (blocked) want = 'stop|這一章只有試讀，先停在這裡';
    else if (st.index >= st.chapters.length - 1) want = 'stop|已經是最後一章';
    else want = 'open|繼續往下，自動接下一章';
    if (want === lastPaint) return;
    lastPaint = want;
    var parts = want.split('|');
    sentinel.className = 'flow-more' + (parts[0] === 'stop' ? ' stop' : '');
    sentinel.innerHTML = '<span>' + parts[1] + '</span>';
  }`
);

/* 2) makeSentinel 不再無條件重建；已在 thread 裡就只確保是最後一個 */
s = s.replace(
`    if (sentinel && sentinel.parentNode === thread && thread.lastElementChild === sentinel) return;
    if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);`,
`    if (sentinel && sentinel.parentNode === thread && thread.lastElementChild === sentinel) return;
    if (sentinel && sentinel.parentNode === thread) { thread.appendChild(sentinel); return; }
    if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);`
);

/* 3) 只觀察直接子節點（不盯整棵樹，避免串流時被觸發上萬次） */
s = s.replace(
  "    mo.observe(t, { childList: true, subtree: true });",
  "    mo.observe(t, { childList: true });"
);
s = s.replace(
  "  }).observe(document.body, { childList: true, subtree: true });",
  "  }).observe(document.body, { childList: true });"
);

/* 4) 新的哨兵出現時，清掉 paint 快取 */
s = s.replace(
  "    sentinel = document.createElement('div');",
  "    lastPaint = '';\n    sentinel = document.createElement('div');"
);

fs.writeFileSync(f, s, 'utf8');
console.log('flow.js 已修（避免觀察迴圈）');
