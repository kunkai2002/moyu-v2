// ① 桌面：打字時的按鍵、面板開著時，都不算「閱讀手勢」
// ② 手機：只有真正的觸控/滾輪手勢才允許自動接章；並記住最近讀過的章節
const fs = require('fs');

/* ── desktop flow.js ── */
{
  const f = 'ui/flow.js';
  let s = fs.readFileSync(f, 'utf8');
  const must = (a, t) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + t); process.exit(1); } };
  must("  window.addEventListener('keydown', function (e) {", 'flow keydown');
  if (!s.includes('function typingIn')) {
    s = s.replace(
      "  window.addEventListener('keydown', function (e) {",
      `  function typingIn(e) {
    var t = e.target;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }
  function panelOpen() {
    return !!document.querySelector('.panel:not([hidden]), .marks-panel:not([hidden]), .stats-panel:not([hidden]), .detail:not([hidden]), .hist-panel:not([hidden]), .phone-panel:not([hidden]), .overflow:not([hidden])');
  }

  window.addEventListener('keydown', function (e) {
    if (typingIn(e) || panelOpen()) return;   // 打字、開面板都不算閱讀手勢`
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('flow.js: 手勢只算真正的閱讀動作');
  } else console.log('flow.js 已有 typingIn');
}

/* ── mobile app.js ── */
{
  const f = 'sync/m/app.js';
  let s = fs.readFileSync(f, 'utf8');
  const must = (a, t) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + t); process.exit(1); } };

  /* 1) 手勢旗標 */
  must('  var toastTimer = null;', 'mobile toast decl');
  if (!s.includes('var userGesture')) {
    s = s.replace(
      '  var toastTimer = null;',
      `  var userGesture = false;   // 使用者真的滑了才允許自動接章
  var toastTimer = null;`
    );
  }

  /* 2) 手勢來源 */
  must('  window.addEventListener(\'scroll\', onScroll, { passive: true });', 'mobile scroll bind');
  s = s.replace(
    "  window.addEventListener('scroll', onScroll, { passive: true });",
    `  ['touchstart', 'touchmove', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (state.book && !state.busy) userGesture = true;
    }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (state.book && /^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) userGesture = true;
  });
  window.addEventListener('scroll', onScroll, { passive: true });`
  );

  /* 3) onScroll：沒手勢不接章 */
  must(`      var near = (window.innerHeight + y) >= (document.body.scrollHeight - 260);
      if (!near || state.busy || state.done || !state.book) return;
      if (state.index >= state.chapters.length - 1) return;
      readFrom(state.index + 1, { mark: true });`, 'mobile onScroll body');
  s = s.replace(
    `      var near = (window.innerHeight + y) >= (document.body.scrollHeight - 260);
      if (!near || state.busy || state.done || !state.book) return;
      if (state.index >= state.chapters.length - 1) return;
      readFrom(state.index + 1, { mark: true });`,
    `      var near = (window.innerHeight + y) >= (document.body.scrollHeight - 260);
      if (!near || state.busy || state.done || !state.book) return;
      if (!userGesture) return;          // 程式造成的捲動不算
      if (state.index >= state.chapters.length - 1) return;
      userGesture = false;               // 一次手勢只接一章
      readFrom(state.index + 1, { mark: true });`
  );

  /* 4) 最近讀過：記錄 + 目錄頂部顯示 */
  if (!s.includes('pushHistory')) {
    must('  function rememberChapter(bookId, ch) {', 'mobile rememberChapter');
    s = s.replace(
      `  function rememberChapter(bookId, ch) {
    saveLocal('last:' + bookId, { id: ch.id, no: ch.no, title: ch.title || '' });
  }`,
      `  function rememberChapter(bookId, ch) {
    saveLocal('last:' + bookId, { id: ch.id, no: ch.no, title: ch.title || '' });
    try {
      var key = 'hist:' + bookId;
      var list = loadLocal(key, []) || [];
      list = list.filter(function (x) { return x.id !== ch.id; });
      list.unshift({ id: ch.id, no: ch.no, title: ch.title || '', at: Date.now() });
      saveLocal(key, list.slice(0, 8));
    } catch (e) {}
  }
  function historyOf(bookId) { return loadLocal('hist:' + bookId, []) || []; }`
    );
  }

  /* 開書時建立歷史 */
  must(`    if (hit.from !== 'start' && ch) {
      rememberChapter(bookId, ch);`, 'mobile open remember');
  s = s.replace(
    `    if (hit.from !== 'start' && ch) {
      rememberChapter(bookId, ch);`,
    `    if (ch) rememberChapter(bookId, ch);
    if (hit.from !== 'start' && ch) {`
  );

  /* 目錄：頂部「最近讀過」 */
  must(`  function openToc() {
    var list = $('tocList');
    list.innerHTML = '';`, 'mobile openToc');
  s = s.replace(
    `  function openToc() {
    var list = $('tocList');
    list.innerHTML = '';`,
    `  function openToc() {
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
          + '<span class="toc-t">' + esc((h.title || '').replace(/^第\\s*\\d+[章節]?\\s*/, '')) + '</span>';
        b.addEventListener('click', function () { closeToc(); readFrom(i, { wipe: true, mark: true }); });
        list.appendChild(b);
      });
      var div = document.createElement('div');
      div.className = 'toc-sec';
      div.textContent = '全部章節';
      list.appendChild(div);
    }`
  );

  fs.writeFileSync(f, s, 'utf8');
  console.log('app.js（手機）: 手勢閘 + 最近讀過');
}

/* ── 手機 CSS：目錄小節標題 ── */
{
  const f = 'sync/m/app.css';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('.toc-sec')) {
    s = s.replace(
      '.toc-r:active{background:var(--bg)}',
      `.toc-sec{padding:10px 12px 4px;font-size:10.5px;color:var(--fg3);letter-spacing:.5px}
.toc-recent{background:color-mix(in srgb,var(--acc) 5%,transparent)}
.toc-r:active{background:var(--bg)}`
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('app.css: 目錄小節樣式');
  }
}
