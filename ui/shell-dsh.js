/* 外殼的行為層（兩個殼共用；2026-11-07 重做：照真工具、九成像）
   ─────────────────────────────────────────────────────────────
   data-shell="dsh" ＝ DeepSeek Harness 桌面版；data-shell="cc" ＝ Claude 桌面程式的 Code 分頁。
   樣式：ui/shell-base.css（兩邊共用的骨架、抽屜）＋ shell-dsh.css ＋ shell-cc.css。

   這支只做四件事：
   ① 放對位置：前後鍵、權限、模型、檔案清單 #tree 在兩個工具裡的位置不同，切殼時把同一個節點搬過去
      （搬 DOM 節點，事件監聽跟著走；不複製、不重畫）
   ② 左欄清單：dsh＝資料夾（最近的工作區）＋會話（這個工作區最近開過的檔案，帶「16小时」）；
                cc＝專案標題＋整份 session 清單（#tree）＋其他專案
   ③ 只有一邊有的區塊：dsh 輸入卡下面那一行統計、右緣的訊息刻度；cc 右欄 Environment／Context／Outputs
   ④ 版面：側欄／右欄在版面裡還是抽屜（layoutPass；斷點只在這裡） */
(function () {
  'use strict';

  var D = window.__moyuDebug;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var shell = function () { return document.documentElement.getAttribute('data-shell') || 'dsh'; };
  var stripNo = function (t) { return String(t || '').replace(/^第\s*\d+\s*[章回节節]\s*/, '') || String(t || ''); };
  var SVG = {
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l1.8 2H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.2l2.8 1.8"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m8 10 4 4 4-4"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m10 8 4 4-4 4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
    laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="5.5" width="14" height="10" rx="1.5"/><path d="M3 18.5h18"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="2.8"/><path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7"/></svg>',
    branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 8v8M17 10c0 3.5-3 4-8.5 6"/></svg>',
    cursor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m6 4.5 12 6.5-5.2 1.6L10.6 18z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5v4h4"/></svg>',
    term: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 7.5 4.5 4.5L5 16.5M12 17h7"/></svg>',
    tray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M12 8v6.5M9 11.5l3 3 3-3"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15M12 4.5c2.2 2.2 3.2 4.7 3.2 7.5s-1 5.3-3.2 7.5c-2.2-2.2-3.2-4.7-3.2-7.5s1-5.3 3.2-7.5z"/></svg>',
    folderOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l1.8 2H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg>',
  };
  var PLACEHOLDER = {
    dsh: '发消息或创建任务，/ 调用指令，@ 文件或对话',
    cc: 'Enter to send, Ctrl+Enter to queue for later',
  };

  /* ── 拜訪紀錄：這個工作區最近開過哪些檔案（dsh 左欄「會話」用）── */
  function visitKey() { return 'moyu.visits.' + ((D && D.state && D.state.book && D.state.book.id) || '_'); }
  function readVisits() { try { return JSON.parse(localStorage.getItem(visitKey()) || '[]'); } catch (e) { return []; } }
  function recordVisit() {
    if (!D || !D.state || !D.state.book) return;
    var i = D.state.index || 0;
    var c = (D.state.chapters || [])[i];
    if (!c) return;
    var list = readVisits().filter(function (v) { return v.i !== i; });
    list.unshift({ i: i, t: stripNo(c.title), at: Date.now() });
    try { localStorage.setItem(visitKey(), JSON.stringify(list.slice(0, 40))); } catch (e) {}
  }
  function ago(at) {
    var s = Math.max(0, (Date.now() - (at || 0)) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + '分钟';
    if (s < 86400) return Math.floor(s / 3600) + '小时';
    return Math.floor(s / 86400) + '天';
  }
  function recentBooks() {
    try { return (window.__moyuShell && window.__moyuShell.recentList()) || []; } catch (e) { return []; }
  }
  function curBook() { return (D && D.state && D.state.book) || null; }

  /* ── ② 左欄清單 ─────────────────────────────────────────── */
  var dshExpanded = false;
  function renderSideDsh() {
    var box = $('#sideRecent');
    if (!box) return;
    var cur = curBook();
    var books = recentBooks();
    if (cur && !books.some(function (b) { return b.id === cur.id; })) books.unshift({ id: cur.id, title: cur.title });
    if (!books.length) { box.innerHTML = '<div class="side-empty">还没有会话</div>'; return; }
    var html = '';
    books.slice(0, 6).forEach(function (b) {
      var isCur = cur && b.id === cur.id;
      html += '<button class="ws-folder' + (isCur ? ' on' : '') + '" data-book="' + esc(b.id) + '" title="' + esc(b.title || b.id) + '">'
        + SVG.folder + '<span class="ws-name">' + esc(b.title || b.id) + '</span></button>';
      if (!isCur) return;
      var visits = readVisits();
      var idx = (D.state && D.state.index) || 0;
      if (!visits.length || visits[0].i !== idx) {
        var c = (D.state.chapters || [])[idx];
        if (c) visits.unshift({ i: idx, t: stripNo(c.title), at: Date.now() });
      }
      var shown = dshExpanded ? visits.slice(0, 20) : visits.slice(0, 5);
      shown.forEach(function (v, k) {
        html += '<button class="sr-row' + (v.i === idx ? ' on' : '') + '" data-i="' + v.i + '" title="' + esc(v.t) + '">'
          + (k > 0 && k % 3 === 0 ? '<span class="sr-ico">' + SVG.clock + '</span>' : '')
          + '<span class="sr-t">' + esc(v.t) + '</span><span class="sr-p">' + ago(v.at) + '</span></button>';
      });
      var rest = visits.length - shown.length;
      if (rest > 0) html += '<button class="sr-more" data-more="1">展开其余 ' + rest + ' 个会话</button>';
      else if (dshExpanded && visits.length > 5) html += '<button class="sr-more" data-more="0">收起</button>';
    });
    box.innerHTML = html;
  }

  function renderSideCc() {
    var box = $('#sideRecent');
    if (!box) return;
    var cur = curBook();
    var books = recentBooks().filter(function (b) { return !cur || b.id !== cur.id; }).slice(0, 4);
    var head = cur
      ? '<div class="cc-proj on"><button class="cc-proj-name" data-toggle="1">' + esc(cur.title || cur.id) + SVG.down + '</button>'
        + '<button class="ic cc-proj-add" id="ccProjAdd" title="New session">' + SVG.plus + '</button></div>'
      : '<div class="side-empty">No sessions yet</div>';
    box.innerHTML = head;
    var others = $('#ccOthers');
    if (others) {
      others.innerHTML = books.map(function (b) {
        return '<div class="cc-proj"><button class="cc-proj-name" data-book="' + esc(b.id) + '">' + esc(b.title || b.id) + SVG.right + '</button></div>';
      }).join('');
    }
  }

  function renderSide() { if (shell() === 'cc') renderSideCc(); else renderSideDsh(); }

  function wireSide() {
    var box = $('#sideRecent');
    if (box && !box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('button') : null;
        if (!t || !D) return;
        if (t.dataset.book && (!curBook() || t.dataset.book !== curBook().id)) { D.openBook(t.dataset.book); return; }
        if (t.dataset.i != null) { D.goChapter(Number(t.dataset.i)); return; }
        if (t.dataset.more != null) { dshExpanded = t.dataset.more === '1'; renderSideDsh(); return; }
        if (t.id === 'ccProjAdd') { D.openShelf && D.openShelf(); return; }
        if (t.dataset.toggle) { document.querySelector('.app').classList.toggle('cc-tree-folded'); }
      });
    }
    var others = $('#ccOthers');
    if (others && !others.dataset.bound) {
      others.dataset.bound = '1';
      others.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('button[data-book]') : null;
        if (t && D) D.openBook(t.dataset.book);
      });
    }
  }

  /* ── ① 放對位置 ─────────────────────────────────────────── */
  function ensureHosts() {
    var region = $('.side-region');
    if (region && !$('#ccTreeHost')) {
      var host = document.createElement('div');
      host.id = 'ccTreeHost'; host.className = 'cc-tree-host only-cc';
      region.appendChild(host);
      var others = document.createElement('div');
      others.id = 'ccOthers'; others.className = 'cc-others only-cc';
      region.appendChild(others);
    }
    // cc 右上那一排（Claude：面板｜終端｜匯出｜瀏覽器｜資料夾｜⋯）——只建一次
    var r = $('.topbar-r');
    if (r && !$('#ccTerm')) {
      var mk = function (id, svg, title, run) {
        var b = document.createElement('button');
        b.className = 'tb-btn only-cc'; b.id = id; b.title = title; b.innerHTML = svg;
        b.addEventListener('click', function (e) { e.stopPropagation(); run(); });
        return b;
      };
      var more = $('#tbMore');
      r.insertBefore(mk('ccTerm', SVG.term, 'Terminal', function () { D && D.boss && D.boss(true); }), more);
      r.insertBefore(mk('ccExport', SVG.tray, 'Export', function () { var p = $('#pillDownload'); if (p) p.click(); }), more);
      r.insertBefore(mk('ccGlobe', SVG.globe, 'Open in browser', function () { window.__moyuPhone && window.__moyuPhone.toggle(); }), more);
      r.insertBefore(mk('ccFolder', SVG.folderOpen, 'Recent', function () { window.__moyuShell && window.__moyuShell.toggleHistory(); }), more);
    }
    // dsh 標題列：「应用」「编辑」選單（只有 Electron 有自訂標題列）
    var tb = $('.titlebar');
    document.documentElement.classList.toggle('has-tb', !!tb);
    if (tb && !$('#dshMenus')) {
      var m = document.createElement('span');
      m.id = 'dshMenus'; m.className = 'tb-menus only-dsh';
      m.innerHTML = '<button id="dshMenuApp">应用</button><button id="dshMenuEdit">编辑</button>';
      tb.insertBefore(m, tb.firstChild);
      m.querySelector('#dshMenuApp').addEventListener('click', function (e) { e.stopPropagation(); var b = $('#tbMore'); if (b) b.click(); });
      m.querySelector('#dshMenuEdit').addEventListener('click', function (e) { e.stopPropagation(); openPalette(); });
    }
  }

  function place() {
    var s = shell();
    var nav = $('#sideNav'), topbar = $('.topbar'), crumb = $('#crumb');
    var back = $('#tbBack'), fwd = $('#tbFwd'), tbSide = $('#tbSide');
    if (s === 'cc') {
      if (nav && back && back.parentNode !== nav) { nav.appendChild(back); nav.appendChild(fwd); }
    } else if (topbar && back && back.parentNode !== topbar) {
      topbar.insertBefore(fwd, topbar.firstChild); topbar.insertBefore(back, topbar.firstChild);
    }
    // 側欄開關：dsh 在 Electron 時放進標題列最左（跟真的 DSH 一樣），其他情況留在頂欄
    var tb = $('.titlebar');
    if (s === 'dsh' && tb && tbSide && tbSide.parentNode !== tb) tb.insertBefore(tbSide, tb.firstChild);
    if ((s === 'cc' || !tb) && topbar && tbSide && tbSide.parentNode !== topbar) topbar.insertBefore(tbSide, crumb);
    // 權限、模型：dsh 在輸入卡底列；cc 在輸入卡下面那一行
    var perm = $('#permTag'), model = $('#modelPick'), tools = $('.box-tools'), meta = $('#composerMeta');
    var enter = $('#enterBtn');
    if (s === 'cc') {
      // dsh 那一行統計（paintDshMeta 畫的）留在這裡會變成一個超大的時鐘圖示 → 先清掉
      if (meta) { [].slice.call(meta.children).forEach(function (c) { if (c !== model && c !== perm) c.remove(); }); meta.__html = null; }
      if (meta && model && model.parentNode !== meta) { meta.appendChild(model); meta.appendChild(perm); }
    } else if (tools && model && model.parentNode !== tools) {
      tools.insertBefore(perm, $('#modeTag'));
      tools.insertBefore(model, enter);
    }
    // 檔案清單：dsh 在右欄；cc 是左欄的 session 清單
    var tree = $('#tree'), host = $('#ccTreeHost'), toc = $('#tocPanel');
    if (tree && host && toc) {
      if (s === 'cc' && tree.parentNode !== host) host.appendChild(tree);
      if (s !== 'cc' && tree.parentNode !== toc) toc.appendChild(tree);
    }
    var input = $('#input');
    if (input) input.placeholder = PLACEHOLDER[s] || PLACEHOLDER.dsh;
    renderSide();
    paintExtras();
  }

  /* ── ③ 只有一邊有的區塊 ─────────────────────────────────── */
  function txt(sel) { var e = $(sel); return e ? e.textContent.trim() : ''; }
  function progress() {
    var st = D && D.state;
    var n = (st && st.chapters && st.chapters.length) || 0;
    var i = (st && st.index) || 0;
    return { n: n, i: i, no: n ? (st.chapters[i] && st.chapters[i].no) || i + 1 : 0, pct: n ? (i + 1) / n * 100 : 0 };
  }
  function fmtK(v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(v); }

  function paintDshMeta() {
    var meta = $('#composerMeta');
    if (!meta || shell() !== 'dsh') return;
    var p = progress();
    var paras = document.querySelectorAll('#stream .p').length;
    var tok = (txt('#sbTok').match(/\d+/) || ['42'])[0];
    var chars = 0;
    try { chars = Math.round((p.i + 1) * 2.6e5 / 100) * 100; } catch (e) {}
    var html = '<span>' + SVG.clock + p.no + ' 轮 ' + paras + ' 步 · ' + tok + ' tok/s</span>'
      + '<span><i class="dm-db"></i>' + fmtK(chars) + ' tok · 缓存命中 99%</span>'
      + '<span><i class="dm-ring" style="--p:' + p.pct.toFixed(0) + '"></i>' + p.pct.toFixed(0) + '%</span>';
    if (meta.__html !== html) { meta.innerHTML = html; meta.__html = html; }
  }

  function paintCcPanel() {
    var box = $('#ccPanel');
    if (!box || shell() !== 'cc') return;
    var b = curBook();
    var p = progress();
    var name = b ? (b.title || b.id) : 'api-server';
    var marks = (window.__moyuMarks && window.__moyuMarks.has && window.__moyuMarks.has()) || 0;
    var ghostOn = !!(window.__moyuGhost && window.__moyuGhost.state && window.__moyuGhost.state.on);
    var read = p.i, left = Math.max(0, p.n - p.i - 1);
    var pctRead = p.n ? read / p.n * 100 : 0, pctCur = p.n ? 100 / p.n : 0;
    var recent = recentBooks().slice(0, 4);
    var html =
      '<div class="ccp-sec">'
      + '<div class="ccp-h">Environment</div>'
      + '<div class="ccp-row">' + SVG.laptop + '<span class="ccp-l">' + esc(name) + '</span><button class="ic" data-act="settings" title="Settings">' + SVG.gear + '</button></div>'
      + '<div class="ccp-row">' + SVG.folder + '<span class="ccp-l">' + esc(name) + ' · D:\\</span></div>'
      + '<div class="ccp-row">' + SVG.branch + '<span class="ccp-l">main/§' + p.no + '</span><span class="ccp-r">Worktree</span></div>'
      + '<div class="ccp-row">' + SVG.cursor + '<span class="ccp-l">Remote Control</span><button class="ccp-sw' + (ghostOn ? ' on' : '') + '" data-act="ghost" title="Remote Control"><i></i></button></div>'
      + '</div>'
      + '<div class="ccp-sec">'
      + '<div class="ccp-h">Context</div>'
      + '<div class="ccp-use"><b>' + p.pct.toFixed(0) + '% used</b><span>' + p.no + ' / ' + p.n + '</span></div>'
      + '<div class="ccp-bar"><i style="width:' + pctRead.toFixed(2) + '%"></i><i class="c2" style="width:' + Math.max(.8, pctCur).toFixed(2) + '%"></i></div>'
      + '<div class="ccp-kv"><i class="k1"></i><span>Messages</span><b>' + fmtK(read) + '</b><em>' + pctRead.toFixed(1) + '%</em></div>'
      + '<div class="ccp-kv"><i class="k2"></i><span>Current</span><b>1</b><em>' + pctCur.toFixed(1) + '%</em></div>'
      + '<div class="ccp-kv"><i class="k3"></i><span>Marks</span><b>' + marks + '</b><em>—</em></div>'
      + '<div class="ccp-kv"><i class="k4"></i><span>Free space</span><b>' + fmtK(left) + '</b><em>' + (p.n ? (left / p.n * 100).toFixed(1) : '0') + '%</em></div>'
      + '<div class="ccp-foot"><span>' + fmtK(left) + ' until auto-compact</span><button data-act="next">Compact session</button></div>'
      + '</div>'
      + '<div class="ccp-sec"><button class="ccp-link" data-act="sync"><span>Connectors</span>' + SVG.right + '<em>' + recent.length + ' connected</em></button></div>'
      + '<div class="ccp-sec"><div class="ccp-h">Outputs</div>'
      + recent.map(function (r) { return '<button class="ccp-file" data-book="' + esc(r.id) + '">' + SVG.file + '<span>' + esc(r.title || r.id) + '</span></button>'; }).join('')
      + '</div>';
    // 內容沒變就不重畫：每 2 秒整塊換掉會吃掉正在按下去的那一下
    if (box.__html !== html) { box.innerHTML = html; box.__html = html; }
  }

  function wireCcPanel() {
    var box = $('#ccPanel');
    if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      var a = t.dataset.act;
      if (a === 'settings' || a === 'sync') { window.__moyuOpenSettings && window.__moyuOpenSettings(); return; }
      if (a === 'ghost') { window.__moyuGhost && window.__moyuGhost.toggle(); setTimeout(paintCcPanel, 50); return; }
      if (a === 'next' && D) { var s = D.state; if (s && s.index < s.chapters.length - 1) D.goChapter(s.index + 1); return; }
      if (t.dataset.book && D) D.openBook(t.dataset.book);
    });
  }

  /* dsh 右緣的訊息刻度：每一則使用者訊息一格；目前所在那一格加長加深；點一格跳過去 */
  var mmRaf = 0;
  function paintMinimap() {
    if (mmRaf) return;
    mmRaf = requestAnimationFrame(function () {
      mmRaf = 0;
      var nav = $('#dsMinimap'), st = $('#stream'), th = st && st.querySelector('.thread');
      if (!nav || !st || shell() !== 'dsh') return;
      // 正文右邊沒空位（右欄停靠、視窗窄）就不畫，免得刻度壓到字
      var room = th ? (st.clientWidth - th.offsetWidth) / 2 : 0;
      nav.style.display = room < 40 ? 'none' : '';
      if (room < 40) return;
      var turns = [].slice.call(st.querySelectorAll('.turn.user')).slice(-14);
      var mid = st.scrollTop + st.clientHeight * 0.4;
      var curIdx = -1;
      turns.forEach(function (t, k) { if (t.offsetTop <= mid) curIdx = k; });
      nav.innerHTML = turns.map(function (t, k) { return '<i' + (k === curIdx ? ' class="on"' : '') + ' data-k="' + k + '"></i>'; }).join('');
      nav.__turns = turns;
    });
  }
  function wireMinimap() {
    var nav = $('#dsMinimap'), st = $('#stream');
    if (!nav || nav.dataset.bound) return;
    nav.dataset.bound = '1';
    nav.addEventListener('click', function (e) {
      var k = e.target.dataset && e.target.dataset.k;
      var t = k != null && nav.__turns && nav.__turns[Number(k)];
      if (t && st) st.scrollTop = Math.max(0, t.offsetTop - 16);
    });
    if (st) st.addEventListener('scroll', paintMinimap, { passive: true });
    if (st) new MutationObserver(paintMinimap).observe(st, { childList: true });
  }

  function paintExtras() {
    var s = shell();
    if (s === 'dsh') { paintDshMeta(); paintMinimap(); }
    if (s === 'cc') { paintCcPanel(); }
    var n = $('#chipAgentsN');
    if (n) n.textContent = String((window.__moyuMarks && window.__moyuMarks.has && window.__moyuMarks.has()) || 0);
    var perm = $('#permTag'), mode = $('#modeTag');
    if (perm && mode) perm.classList.toggle('on', mode.dataset.mode === 'on');
    var vis = $('#visionTag');
    if (vis) vis.classList.toggle('on', !!(window.__moyuGhost && window.__moyuGhost.state && window.__moyuGhost.state.on));
    var home = !!(window.__moyuShell && window.__moyuShell.homeVisible);
    var h = $('#ccHome'), c = $('#ccCode');
    if (h && c) { h.classList.toggle('on', home); c.classList.toggle('on', !home); }
  }

  /* ── 對話／原文（dsh 的「轨迹」）── */
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
    }).join('\n\n') || '（空）';
  }
  function setView(view) {
    var tabs = document.querySelectorAll('.head-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].dataset.view === view);
    var stream = $('#stream');
    var pre = buildSrcView();
    if (view === 'src') { paintSrc(); pre.hidden = false; if (stream) stream.style.visibility = 'hidden'; }
    else { pre.hidden = true; if (stream) stream.style.visibility = ''; }
  }

  function openPalette() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  }

  function wireButtons() {
    var on = function (id, fn) {
      var el = document.getElementById(id);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('click', function (e) { e.stopPropagation(); fn(e); });
    };
    var tabs = document.querySelectorAll('.head-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        if (t.dataset.bound) return;
        t.dataset.bound = '1';
        t.addEventListener('click', function () { setView(t.dataset.view); });
      })(tabs[i]);
    }
    on('tabStats', function () { window.__moyuStatsPanel && window.__moyuStatsPanel.toggle(); });
    on('tabMore', function () { var b = $('#tbMore'); if (b) b.click(); });
    on('bookName', function () { D && D.openShelf && D.openShelf(); });
    on('saMore', function () {
      /* 以前這裡少了 stopPropagation：#tbMore 剛打開選單，同一下 click 冒泡到 document 又被關掉 */
      var app = $('.app'); if (app) app.classList.remove('side-open');
      var b = $('#tbMore'); if (b) b.click();
    });
    on('saSearch', openPalette);
    on('saCustom', function () { window.__moyuOpenSettings && window.__moyuOpenSettings(); });
    on('ccMenuBtn', function () { var b = $('#tbMore'); if (b) b.click(); });
    on('ccHome', function () { window.__moyuShell && window.__moyuShell.openHome(); setTimeout(paintExtras, 30); });
    on('ccCode', function () {
      var b = curBook(), last = D && D.state && D.state.progress && D.state.progress.lastBook;
      if (window.__moyuShell && window.__moyuShell.homeVisible && (b || last)) { window.__moyuShell.homeVisible = false; D.openBook((b && b.id) || last); }
      setTimeout(paintExtras, 30);
    });
    on('crumbMenu', openPalette);
    on('wsSearch', openPalette);
    on('wsFilter', function () { window.__moyuShell && window.__moyuShell.toggleHistory(); });
    on('wsNew', function () { D && D.openShelf && D.openShelf(); });
    on('chipTeam', function () { window.__moyuOpenSettings && window.__moyuOpenSettings(); });
    on('chipMode', function () {
      var t = document.documentElement.getAttribute('data-theme');
      var next = t === 'dsh-light' ? 'dsh' : t === 'dsh' ? 'dsh-light' : t === 'claude' ? 'claude-code' : t === 'claude-code' ? 'claude' : 'dsh-light';
      D && D.setTheme && D.setTheme(next);
    });
    on('chipAgents', function () { window.__moyuMarksPanel && window.__moyuMarksPanel.toggle(); });
    on('permTag', function () { var m = $('#modeTag'); if (m) m.click(); setTimeout(paintExtras, 20); });
    on('visionTag', function () { window.__moyuGhost && window.__moyuGhost.toggle(); setTimeout(paintExtras, 50); });
    on('modelPick', function () { window.__moyuOpenSettings && window.__moyuOpenSettings(); });
    var tocBtn = $('#tocBtn');
    if (tocBtn && !tocBtn.dataset.bound) {
      tocBtn.dataset.bound = '1';
      tocBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleToc(); });
    }
    on('brandToggle', toggleSide);
    on('tbSide', toggleSide);

    // 抽屜：點一列、點遮罩、Esc 收起來
    if (!document.__moyuTocBound) {
      document.__moyuTocBound = 1;
      document.addEventListener('click', function (e) {
        var app = $('.app');
        if (!app || !app.classList.contains('toc-open')) return;
        var t = e.target;
        if (t.closest && (t.closest('#tbList') || t.closest('#tocBtn'))) return;
        if (t.closest && t.closest('.dsh-right') && !t.closest('#tree .ch') && !t.closest('[data-book]') && !t.closest('[data-act="next"]')) return;
        app.classList.remove('toc-open');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var app = $('.app');
        if (app) { app.classList.remove('toc-open'); app.classList.remove('side-open'); }
      });
    }
    var side = $('.side');
    if (side && !side.dataset.drawerBound) {
      side.dataset.drawerBound = '1';
      side.addEventListener('click', function (e) {
        var app = $('.app');
        if (!app || !app.classList.contains('side-drawer')) return;
        var t = e.target;
        if (t.closest && (t.closest('.sr-row') || t.closest('.sa') || t.closest('#tree .ch') || t.closest('[data-book]') || t.closest('#meRow'))) {
          setTimeout(function () { app.classList.remove('side-open'); }, 0);
        }
      });
    }
  }

  /* 側欄：寬視窗＝在版面裡收起／展開（記住）；抽屜模式＝滑出／收回 */
  function toggleSide() {
    var app = $('.app');
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
  /* 右欄：停靠時收起／展開（dataset.toc）；抽屜模式滑出／收回 */
  function toggleToc() {
    var app = $('.app');
    if (!app) return;
    if (app.classList.contains('toc-overlay')) {
      app.classList.toggle('toc-open');
      if (app.classList.contains('toc-open')) { app.classList.remove('side-open'); paintExtras(); }
      return;
    }
    app.classList.remove('toc-open');
    app.dataset.toc = app.dataset.toc === '0' ? '1' : '0';
    layoutPass();
  }
  window.__moyuToggleToc = toggleToc;
  window.__moyuToggleSide = toggleSide;

  /* ── ④ 版面 ────────────────────────────────────────────────
       側欄  ≥ SIDE_BP 在版面裡；使用者可收起（moyu.sideOff；舊鍵 sideHidden 是 10 月遺留，刻意不讀）
             < SIDE_BP → 抽屜 .side-drawer
       右欄  ≥ TOC_BP 停靠；可收起（dataset.toc='0'）；< TOC_BP → 抽屜 .toc-overlay
       JOJO 平常開 613×789：側欄固定在版面裡的話正文只剩 232px，所以窄視窗一定是抽屜。 */
  var SIDE_BP = 900;
  var TOC_BP = 1180;
  var SIDE_KEY = 'moyu.sideOff';
  function sideHiddenPref() {
    try { return localStorage.getItem(SIDE_KEY) === '1'; } catch (e) { return false; }
  }
  function layoutPass() {
    var app = $('.app');
    if (!app) return;
    var vw = window.innerWidth;
    var sideDrawer = vw < SIDE_BP;
    var sideOff = !sideDrawer && sideHiddenPref();
    var dockToc = vw >= TOC_BP && app.dataset.toc !== '0';
    app.classList.toggle('side-drawer', sideDrawer);
    app.classList.toggle('side-hidden', sideOff);
    if (!sideDrawer) app.classList.remove('side-open');
    app.classList.remove('side-rail');
    app.classList.toggle('toc-overlay', vw < TOC_BP);
    app.classList.toggle('toc-collapsed', !dockToc && vw >= TOC_BP);
    if (vw >= TOC_BP) app.classList.remove('toc-open');
    var tbList = $('#tbList');
    if (tbList) tbList.classList.toggle('on', dockToc);
    var st = $('#stream');
    if (st && st.offsetWidth) app.style.setProperty('--fr-sb', Math.max(0, (st.offsetWidth - st.clientWidth) / 2) + 'px');
  }
  window.__moyuLayoutPass = layoutPass;
  window.__moyuLayoutBreakpoints = { side: SIDE_BP, toc: TOC_BP };
  window.__moyuShellPlace = place;

  /* 換書／換檔之後要重畫：包住既有動作（chrome.js 已包過一層歷史，這裡再記拜訪） */
  function wrap(name) {
    if (!D || typeof D[name] !== 'function' || D[name].__shellWrap) return;
    var orig = D[name];
    var w = async function () {
      var r = await orig.apply(this, arguments);
      if (window.__moyuShell) window.__moyuShell.homeVisible = false;
      recordVisit();
      renderSide(); paintExtras();
      return r;
    };
    w.__shellWrap = 1;
    D[name] = w;
  }

  function boot() {
    ensureHosts();
    ['openBook', 'goChapter'].forEach(wrap);
    if (D && typeof D.openShelf === 'function' && !D.openShelf.__shellWrap) {
      var os = D.openShelf;
      D.openShelf = async function () { var r = await os.apply(this, arguments); paintExtras(); return r; };
      D.openShelf.__shellWrap = 1;
    }
    wireButtons();
    wireSide();
    wireCcPanel();
    wireMinimap();
    place();
    layoutPass();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { renderSide(); paintExtras(); } });
    var t0 = null;
    window.addEventListener('resize', function () { clearTimeout(t0); t0 = setTimeout(layoutPass, 120); });
    new MutationObserver(function () { place(); layoutPass(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-shell'] });
    var mode = $('#modeTag');
    if (mode) new MutationObserver(paintExtras).observe(mode, { attributes: true, attributeFilter: ['data-mode'] });
    setInterval(function () { if (!document.hidden) paintExtras(); }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
