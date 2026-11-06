/* 外殼的行為層（兩個殼共用；樣式在 ui/frame.css）
   ─────────────────────────────────────────────────────────────
   ① 側欄「最近」＝最近讀過的書（點一列回到上次那一章）
   ② 頂欄兩個 tab：對話／原文（原文是純文字視圖，含段落索引）
   ③ 側欄「更多」列開既有溢出面板（#tbMore），不是新按鈕
   ④ 響應式：側欄／文件欄在版面裡還是抽屜（layoutPass，2026-11-06 重新設計） */
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
      more.addEventListener('click', function (e) {
        /* 以前這裡少了 stopPropagation：#tbMore 剛把選單打開，同一次 click 冒泡到 document
           又被 chrome.js 的「點外面就關」關掉 → 側欄「更多」按了沒反應。 */
        e.stopPropagation();
        var app = document.querySelector('.app');
        if (app) app.classList.remove('side-open');
        var b = document.querySelector('#tbMore');
        if (b) b.click();
        else if (window.__moyuDebug && window.__moyuDebug.toggleHelp) window.__moyuDebug.toggleHelp();
      });
    }
    var tocBtn = $('#tocBtn');
    if (tocBtn && !tocBtn.dataset.bound) {
      tocBtn.dataset.bound = '1';
      tocBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleToc();
      });
    }
    // 文件抽屜：點一列（跳過去）、點遮罩、Esc 就收起來；點欄內其他地方（篩選框）不收
    if (!document.__moyuTocBound) {
      document.__moyuTocBound = 1;
      document.addEventListener('click', function (e) {
        var app = document.querySelector('.app');
        if (!app || !app.classList.contains('toc-open')) return;
        var t = e.target;
        if (t.closest && (t.closest('#tbList') || t.closest('#tocBtn'))) return;
        if (t.closest && t.closest('#tocPanel') && !t.closest('#tree .ch')) return;
        app.classList.remove('toc-open');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var app = document.querySelector('.app');
        if (app) { app.classList.remove('toc-open'); app.classList.remove('side-open'); }
      });
    }
    // 側欄：收起鈕在側欄裡，展開鈕在頂欄左上角（#tbSide）
    var brandToggle = $('#brandToggle');
    if (brandToggle && !brandToggle.dataset.bound) {
      brandToggle.dataset.bound = '1';
      brandToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleSide();
      });
    }
    var tbSide = $('#tbSide');
    if (tbSide && !tbSide.dataset.bound) {
      tbSide.dataset.bound = '1';
      tbSide.addEventListener('click', function (e) {
        e.stopPropagation();   // 不然 layout.js 的「點外面就收」會在同一次 click 把剛打開的抽屜關掉
        toggleSide();
      });
    }
    // 抽屜裡點了「最近」某一列、新對話、插件…：動作完成就收起來，回到正文
    var side = $('.side');
    if (side && !side.dataset.drawerBound) {
      side.dataset.drawerBound = '1';
      side.addEventListener('click', function (e) {
        var app = document.querySelector('.app');
        if (!app || !app.classList.contains('side-drawer')) return;
        var t = e.target;
        if (t.closest && (t.closest('.sr-row') || t.closest('.sa') || t.closest('#bookName') || t.closest('#meRow'))) {
          setTimeout(function () { app.classList.remove('side-open'); }, 0);
        }
      });
    }
  }

  /* 側欄：寬視窗＝在版面裡收起／展開（記住）；抽屜模式＝滑出／收回（不記） */
  function toggleSide() {
    var app = document.querySelector('.app');
    if (!app) return;
    if (app.classList.contains('side-drawer')) {
      app.classList.toggle('side-open');
      if (app.classList.contains('side-open')) app.classList.remove('toc-open');
      return;
    }
    var off = !app.classList.contains('side-hidden');
    try { localStorage.setItem(SIDE_KEY, off ? '1' : '0'); } catch (e) {}
    layoutPass();
  }

  /* 文件欄：停靠時收起／展開（dataset.toc）；抽屜模式滑出／收回 */
  function toggleToc() {
    var app = document.querySelector('.app');
    if (!app) return;
    if (app.classList.contains('toc-overlay')) {
      app.classList.toggle('toc-open');
      if (app.classList.contains('toc-open')) app.classList.remove('side-open');
      return;
    }
    app.classList.remove('toc-open');
    app.dataset.toc = app.dataset.toc === '0' ? '1' : '0';
    layoutPass();
  }
  window.__moyuToggleToc = toggleToc;
  window.__moyuToggleSide = toggleSide;

  /* ── ④ 版面：依視窗寬度決定側欄／文件欄是「在版面裡」還是「抽屜」 ──
     （2026-11-06 重新設計：不再照 DSH 真值；數字只在這裡和 ui/frame.css）
       側欄    ≥ SIDE_BP 在版面裡；使用者可收起（記在 moyu.sideOff）
               < SIDE_BP 或終端殼（cc）→ 抽屜 .side-drawer，頂欄左上角 #tbSide 滑出
       文件欄  ≥ TOC_BP 停靠在右邊；使用者可收起（dataset.toc='0'）
               < TOC_BP → 抽屜 .toc-overlay，頂欄 #tbList 滑出
     為什麼窄視窗要抽屜：JOJO 平常開 613×789，側欄若固定 280 在版面裡，正文只剩 232px（一行 12 字）。 */
  var SIDE_BP = 900;
  var TOC_BP = 1180;

  /* 收起狀態用新的鍵 moyu.sideOff：舊的 moyu.sideHidden 是 10 月舊介面留下的（JOJO 的設定檔裡還是 1），
     11-04 起早就沒作用；沿用它會讓側欄在寬視窗「自己不見」，跟 11-06「要完整側欄」相反。 */
  var SIDE_KEY = 'moyu.sideOff';
  function sideHiddenPref() {
    try { return localStorage.getItem(SIDE_KEY) === '1'; } catch (e) { return false; }
  }

  function layoutPass() {
    var app = document.querySelector('.app');
    if (!app) return;
    var vw = window.innerWidth;
    var shell = document.documentElement.getAttribute('data-shell') || 'dsh';
    var sideDrawer = shell === 'cc' || vw < SIDE_BP;
    var sideOff = !sideDrawer && sideHiddenPref();
    var dockToc = vw >= TOC_BP && app.dataset.toc !== '0';

    app.classList.toggle('side-drawer', sideDrawer);
    app.classList.toggle('side-hidden', sideOff);
    if (!sideDrawer) app.classList.remove('side-open');
    app.classList.remove('side-rail');                  // 56px 圖示軌已退役
    app.classList.toggle('toc-overlay', vw < TOC_BP);
    app.classList.toggle('toc-collapsed', !dockToc && vw >= TOC_BP);
    if (vw >= TOC_BP) app.classList.remove('toc-open');

    var tbSide = document.querySelector('#tbSide');
    if (tbSide) tbSide.title = sideDrawer ? '打開側欄' : '展開側欄';
    var bt = document.querySelector('#brandToggle');
    if (bt) bt.title = sideDrawer ? '關閉側欄' : '收起側欄';
    var tbList = document.querySelector('#tbList');
    if (tbList) tbList.classList.toggle('on', dockToc);

    // 對話流兩側的捲軸槽寬度（scrollbar-gutter:stable both-edges）：輸入卡要補一樣寬才會跟正文同軸。
    // 桌面細捲軸約 10px；手機是浮動捲軸＝0。量出來，不寫死。
    var st = document.querySelector('#stream');
    if (st && st.offsetWidth) {
      var sb = Math.max(0, (st.offsetWidth - st.clientWidth) / 2);
      app.style.setProperty('--fr-sb', sb + 'px');
    }
  }
  window.__moyuLayoutPass = layoutPass;
  window.__moyuLayoutBreakpoints = { side: SIDE_BP, toc: TOC_BP };
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
    // 切殼（Alt+S、/shell）會改 <html data-shell>：cc 殼的側欄一律是抽屜，要重算
    new MutationObserver(layoutPass).observe(document.documentElement, { attributes: true, attributeFilter: ['data-shell'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
