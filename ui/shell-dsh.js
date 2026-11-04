/* DSH 外殼的行為層（只做 DSH 有的事，不新增元素）
   ─────────────────────────────────────────────────────────────
   ① 側欄「最近」＝最近讀過的書（點一列回到上次那一章，DSH 的會話清單）
   ② 頂欄兩個 tab：對話／原文（原文是純文字視圖，含段落索引）
   ③ 側欄「更多」列開既有溢出面板（#tbMore），不是新按鈕
   ④ 響應式：視窗 < --dsh-auto-collapse（真值 1024px）自動收成 56px 圖示軌
   數值一律走 ui/dsh-tokens.css 的 --dsh-*（由 docs/DSH-真值.json 產生）。 */
(function () {
  'use strict';

  var D = window.__moyuDebug;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  /* ── ① 最近讀過的書 ─────────────────────────────────────── */
  function renderRecent() {
    var box = $('#sideRecent');
    if (!box) return;
    var list = [];
    try { list = (window.__moyuShell && window.__moyuShell.recentList()) || []; } catch (e) { list = []; }
    if (!list.length) { box.innerHTML = '<div class="side-empty">還沒有開過的書</div>'; return; }
    box.innerHTML = '';
    list.slice(0, 12).forEach(function (it) {
      var row = document.createElement('button');
      row.className = 'sr-row';
      row.dataset.book = it.id;
      row.title = it.title || it.id;
      row.innerHTML = '<span class="sr-t">' + esc(it.title || it.id) + '</span>'
        + '<span class="sr-p">' + (it.chapterNo ? '§' + esc(it.chapterNo) : '') + '</span>';
      row.addEventListener('click', function () {
        if (D && D.openBook) D.openBook(it.id);
      });
      box.appendChild(row);
    });
  }

  /* ── ② 對話／原文 tab ──────────────────────────────────── */
  function buildSrcView() {
    var pre = $('#srcView');
    if (pre) return pre;
    pre = document.createElement('pre');
    pre.id = 'srcView';
    pre.className = 'src-view';
    pre.hidden = true;
    var stream = $('#stream');
    if (stream && stream.parentNode) stream.parentNode.insertBefore(pre, stream.nextSibling);
    return pre;
  }

  function paintSrc() {
    var pre = buildSrcView();
    var paras = [].slice.call(document.querySelectorAll('#stream .p'));
    var no = (D && D.state && D.state.chapters[D.state.index]) ? D.state.chapters[D.state.index].no : '';
    pre.textContent = paras.map(function (p, i) {
      return '[' + (no ? no + '.' : '') + (i + 1) + '] ' + p.textContent.trim();
    }).join('\n\n') || '（這一章還沒有內容）';
  }

  function setView(view) {
    var tabs = document.querySelectorAll('.head-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].dataset.view === view);
    var stream = $('#stream');
    var pre = buildSrcView();
    if (view === 'src') { paintSrc(); pre.hidden = false; if (stream) stream.style.visibility = 'hidden'; }
    else { pre.hidden = true; if (stream) stream.style.visibility = ''; }
  }

  function wireTabs() {
    var tabs = document.querySelectorAll('.head-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        if (t.dataset.bound) return;
        t.dataset.bound = '1';
        t.addEventListener('click', function () { setView(t.dataset.view); });
      })(tabs[i]);
    }
  }

  /* ── ③ 側欄三列：新對話＝書架、插件＝標記、更多＝溢出面板 ── */
  function wireRows() {
    var bookName = $('#bookName');
    if (bookName && !bookName.dataset.bound) {
      bookName.dataset.bound = '1';
      bookName.addEventListener('click', function () { if (D && D.openShelf) D.openShelf(); });
    }
    var more = $('#saMore');
    if (more && !more.dataset.bound) {
      more.dataset.bound = '1';
      more.addEventListener('click', function () {
        var b = document.querySelector('#tbMore');
        if (b) b.click();
        else if (window.__moyuDebug && window.__moyuDebug.toggleHelp) window.__moyuDebug.toggleHelp();
      });
    }
    var tocBtn = $('#tocBtn');
    if (tocBtn && !tocBtn.dataset.bound) {
      tocBtn.dataset.bound = '1';
      tocBtn.addEventListener('click', function () {
        var app = document.querySelector('.app');
        app.dataset.toc = app.dataset.toc === '0' ? '1' : '0';
        layoutPass();
      });
    }
    var brandToggle = $('#brandToggle');
    if (brandToggle && !brandToggle.dataset.bound) {
      brandToggle.dataset.bound = '1';
      brandToggle.addEventListener('click', function () {
        var app = document.querySelector('.app');
        app.dataset.rail = app.dataset.rail === '1' ? '0' : '1';
        layoutPass();
      });
    }
  }

  /* ── ④ 三欄寬度：照 DSH computeColumns（真值）算，不寫死 ──
     s = 收合 ? rail : clamp(側欄預設, min, max)
     available = 視窗 - s - 400（真值 rightbarReserve）
     r = available < 300 ? 0 : min(available, clamp(45% 視窗, 300, 70% 視窗))
     內容寬 = clamp(680, 64% 中欄, 920)                                       */
  function num(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, Math.round(v))); }

  function layoutPass() {
    var app = document.querySelector('.app');
    if (!app) return;
    var vw = window.innerWidth;
    var autoCollapse = num('--dsh-auto-collapse', 1024);
    var manualRail = app.dataset.rail === '1';
    var narrow = vw < autoCollapse;
    var rail = narrow !== manualRail && (manualRail || narrow);
    var s = rail
      ? num('--dsh-rail-w', 56)
      : clamp(num('--dsh-sidebar-w', 280), num('--dsh-sidebar-min', 264), num('--dsh-sidebar-max', 420));
    var available = vw - s - num('--dsh-right-reserve', 400);
    var wantRight = app.dataset.toc !== '0';
    var r = 0;
    if (wantRight && available >= 300) {
      // DSH 的公式是 clamp(45% 視窗, 300, 70% 視窗)；但那是給「文件／變更」預覽用的寬度，
      // 這裡的右欄是章節清單，用真值下限 300（= --dsh-right-min）才不會把正文擠到 512px。
      // 想回到 45% 就把下面這行換成 clamp(ratio*vw, min, max) 那版。
      r = Math.min(available, clamp(num('--dsh-right-min', 300),
        num('--dsh-right-min', 300), vw * num('--dsh-right-max-ratio', 0.7)));
    }
    var center = Math.max(0, vw - s - r);
    var content = clamp(num('--dsh-content-ratio', 0.64) * center,
      num('--dsh-content-min', 680), num('--dsh-content-max', 920));

    app.classList.toggle('rail', rail);
    app.classList.toggle('toc-collapsed', r === 0);
    app.style.setProperty('--dsh-col-side', s + 'px');
    app.style.setProperty('--dsh-col-right', r + 'px');
    app.style.setProperty('--dsh-content-w', content + 'px');
  }

  function boot() {
    renderRecent();
    wireTabs();
    wireRows();
    layoutPass();
    // 換書／換章之後「最近」會變：不用輪詢 DOM，回到前景或點側欄時重畫就好
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderRecent(); });
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('.side')) renderRecent();
    }, true);
    var t0 = null;
    window.addEventListener('resize', function () {
      clearTimeout(t0);
      t0 = setTimeout(layoutPass, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
