// 首頁（書架＋最近）與歷史抽屜；頂欄加兩顆按鈕
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── icons.js：home / phone / globe ──────────────────────── */
{
  const f = p('ui/icons.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('home:')) {
    must(s, "    back:    '<path", 'icons back');
    s = s.replace(
      "    back:    '<path",
      "    home:    '<path d=\"M4.2 11.2 12 4.6l7.8 6.6\"/><path d=\"M6.6 10v9.4h10.8V10\"/><path d=\"M10.4 19.4v-4.6h3.2v4.6\"/>',\n"
      + "    phone:   '<rect x=\"7\" y=\"3.2\" width=\"10\" height=\"17.6\" rx=\"2\"/><path d=\"M10.6 18.2h2.8\"/>',\n"
      + "    globe:   '<circle cx=\"12\" cy=\"12\" r=\"7.4\"/><path d=\"M4.6 12h14.8\"/><path d=\"M12 4.6c2.2 2.2 3.3 4.7 3.3 7.4S14.2 17.2 12 19.4c-2.2-2.2-3.3-4.7-3.3-7.4S9.8 6.8 12 4.6z\"/>',\n"
      + "    back:    '<path"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('icons.js ok');
  } else console.log('icons.js 已有 home');
}

/* ── ui/shell.js ─────────────────────────────────────────── */
{
  const src = `/* 首頁、歷史抽屜、面板互斥 */
(function () {
  'use strict';
  var D = window.__moyuDebug;
  var B = window.moyu;
  var $ = function (s) { return document.querySelector(s); };
  if (!D || !B) return;
  var st = D.state;

  var css = document.createElement('style');
  css.textContent = [
    /* 首頁 */
    '.home{max-width:920px}',
    '.home-h{font-size:15px;letter-spacing:.5px;color:var(--fg);margin:0 0 4px}',
    '.home-sub{color:var(--fg3);font-size:12px;margin-bottom:14px}',
    '.home-card{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line-strong);',
    '  border-radius:8px;background:var(--bg-elev);cursor:pointer;margin-bottom:14px}',
    '.home-card:hover{border-color:var(--acc)}',
    '.home-card .hc-t{font-size:13px;color:var(--fg)}',
    '.home-card .hc-p{font-size:11.5px;color:var(--fg3);margin-top:2px}',
    '.home-card .hc-go{margin-left:auto;color:var(--fg3);display:flex;align-items:center}',
    '.home-card:hover .hc-go{color:var(--acc)}',
    '.home-sec{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--fg3);margin:16px 0 8px;',
    '  display:flex;align-items:center;gap:8px}',
    '.home-sec button{margin-left:auto;font-size:11px;color:var(--fg3);border:1px solid var(--line);',
    '  border-radius:5px;padding:2px 8px}',
    '.home-sec button:hover{color:var(--fg);border-color:var(--acc)}',
    '.home-recent{display:flex;flex-direction:column;gap:2px}',
    '.home-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;',
    '  font-size:12.5px;color:var(--fg2)}',
    '.home-row:hover{background:var(--sel);color:var(--fg)}',
    '.home-row .hr-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.home-row .hr-p{margin-left:auto;color:var(--fg3);font-size:11px;flex:none}',
    '.home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}',
    '.home-book{display:flex;flex-direction:column;gap:4px;padding:8px;border:1px solid var(--line);',
    '  border-radius:7px;background:var(--bg-elev);cursor:pointer;text-align:left}',
    '.home-book:hover{border-color:var(--acc)}',
    '.home-book .hb-t{font-size:12px;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.home-book .hb-p{font-size:10.5px;color:var(--fg3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.home-empty{color:var(--fg3);font-size:12px;padding:8px 2px}',

    /* 歷史抽屜 */
    '.hist-panel{position:absolute;right:18px;top:44px;bottom:34px;width:340px;z-index:46;',
    '  background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;',
    '  box-shadow:0 18px 50px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden}',
    '.hist-panel[hidden]{display:none}',
    '.hist-list{flex:1;overflow:auto}',
    '.hist-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);',
    '  cursor:pointer;font-size:12.5px;color:var(--fg2)}',
    '.hist-row:hover{background:var(--sel);color:var(--fg)}',
    '.hist-row .hs-t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hist-row .hs-p{color:var(--fg3);font-size:10.5px;flex:none}',
    '.hist-empty{padding:16px;color:var(--fg3);font-size:12px;text-align:center}',
  ].join('\\n');
  document.head.appendChild(css);

  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  /* ── 面板互斥 ── */
  function closeOthers(except) {
    document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail').forEach(function (el) {
      if (el !== except) el.hidden = true;
    });
  }

  /* ── 資料：最近/進度 ── */
  function recentList() {
    var out = [];
    var seen = {};
    try {
      var rec = JSON.parse(localStorage.getItem('moyu.recent') || '[]');
      for (var i = 0; i < rec.length; i++) {
        if (seen[rec[i].id]) continue;
        seen[rec[i].id] = 1;
        out.push({ id: rec[i].id, title: rec[i].title, at: rec[i].at });
      }
    } catch (e) {}
    var books = (st.progress && st.progress.books) || {};
    Object.keys(books).forEach(function (id) {
      var b = books[id] || {};
      if (seen[id]) {
        var hit = out.find(function (x) { return x.id === id; });
        if (hit) { hit.chapterNo = b.chapterNo; hit.chapterTitle = b.title; hit.at = b.updated || hit.at; }
        return;
      }
      seen[id] = 1;
      out.push({ id: id, title: b.title || id, chapterNo: b.chapterNo, chapterTitle: b.title, at: b.updated || 0 });
    });
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return out;
  }

  /* ── 首頁 ── */
  async function openHome() {
    closeOthers(null);
    document.querySelector('.app')?.classList.remove('side-open');
    var body;
    if (typeof D.welcome === 'function') { /* 保留相容 */ }
    // 用對話流渲染首頁，跟其他畫面一致
    var stream = document.querySelector('#stream');
    if (stream) stream.innerHTML = '';
    var t = document.createElement('div');
    t.className = 'thread';
    stream.appendChild(t);
    var wrap = document.createElement('div');
    wrap.className = 'assistant';
    wrap.innerHTML = '<div class="who">魔芋一夏</div>';
    body = document.createElement('div');
    body.className = 'home';
    wrap.appendChild(body);
    t.appendChild(wrap);
    stream.scrollTop = 0;

    var list = recentList();
    var last = list[0];
    var html = '<div class="home-h">首頁</div><div class="home-sub">選一本書，或接著上次讀。</div>';

    if (last) {
      var pct = last.chapterNo ? '第 ' + last.chapterNo + ' 章' : '上次讀到';
      html += '<div class="home-card" id="homeContinue"><div><div class="hc-t">' + esc(last.title) + '</div>'
        + '<div class="hc-p">' + esc(pct) + (last.chapterTitle ? ' · ' + esc(last.chapterTitle) : '') + '</div></div>'
        + '<span class="hc-go">' + (window.MOYU_ICONS ? window.MOYU_ICONS.svg('forward', 16) : '→') + '</span></div>';
    }

    html += '<div class="home-sec">最近</div><div class="home-recent">';
    if (!list.length) html += '<div class="home-empty">還沒有開過的書。</div>';
    for (var i = 0; i < Math.min(list.length, 6); i++) {
      var it = list[i];
      html += '<div class="home-row" data-book="' + esc(it.id) + '"><span class="hr-t">' + esc(it.title) + '</span>'
        + '<span class="hr-p">' + (it.chapterNo ? '第 ' + esc(it.chapterNo) + ' 章' : '') + '</span></div>';
    }
    html += '</div>';

    html += '<div class="home-sec">書架<button id="homeReload">重新載入</button></div>'
      + '<div class="home-grid" id="homeShelf"><div class="home-empty">讀取書架…</div></div>';

    body.innerHTML = html;

    body.querySelectorAll('[data-book]').forEach(function (row) {
      row.addEventListener('click', function () { D.openBook(row.dataset.book); });
    });
    var cont = body.querySelector('#homeContinue');
    if (cont) cont.addEventListener('click', function () { D.openBook(last.id); });
    body.querySelector('#homeReload')?.addEventListener('click', function () { paintShelf(true); });

    async function paintShelf(force) {
      var grid = body.querySelector('#homeShelf');
      if (!grid) return;
      var books = [];
      try {
        var cached = await B.shelf?.cached?.();
        if (Array.isArray(cached) && cached.length && !force) books = cached;
        if (!books.length) {
          var r = await B.shelf?.raw?.();
          if (r && r.ok) books = r.books || [];
          else if (r && r.error) { grid.innerHTML = '<div class="home-empty">' + esc(r.error) + '</div>'; return; }
        }
      } catch (e) {
        grid.innerHTML = '<div class="home-empty">' + esc(e.message) + '</div>';
        return;
      }
      if (!books.length) { grid.innerHTML = '<div class="home-empty">書架是空的，先掃碼登入。</div>'; return; }
      grid.innerHTML = '';
      books.slice(0, 24).forEach(function (b) {
        var el = document.createElement('button');
        el.className = 'home-book';
        el.innerHTML = '<span class="hb-t">' + esc(b.title || b.id) + '</span>'
          + '<span class="hb-p">' + esc(b.chapterTitle || (b.chapterOrder ? '第 ' + b.chapterOrder + ' 章' : '未開始')) + '</span>';
        el.addEventListener('click', function () { D.openBook(b.id); });
        grid.appendChild(el);
      });
    }
    paintShelf(false);
    window.__moyuShell = window.__moyuShell || {};
    window.__moyuShell.homeVisible = true;
    return true;
  }

  /* ── 歷史抽屜 ── */
  var panel = document.createElement('div');
  panel.className = 'hist-panel';
  panel.hidden = true;
  panel.innerHTML = '<div class="panel-head"><b>歷史</b>'
    + '<button class="ghost icon" id="histClose" title="關閉">'
    + (window.MOYU_ICONS ? window.MOYU_ICONS.svg('close', 14) : '×') + '</button></div>'
    + '<div class="hist-list" id="histList"></div>';
  document.querySelector('.main')?.appendChild(panel);

  var listEl = panel.querySelector('#histList');
  panel.querySelector('#histClose').addEventListener('click', function () { panel.hidden = true; });

  function paintHistory() {
    var list = recentList();
    if (!list.length) { listEl.innerHTML = '<div class="hist-empty">還沒有開過的書。</div>'; return; }
    listEl.innerHTML = '';
    list.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'hist-row';
      var when = it.at ? new Date(it.at).toLocaleDateString() : '';
      row.innerHTML = '<span class="hs-t">' + esc(it.title || it.id) + '</span>'
        + '<span class="hs-p">' + (it.chapterNo ? '第 ' + esc(it.chapterNo) + ' 章 · ' : '') + esc(when) + '</span>';
      row.addEventListener('click', async function () {
        panel.hidden = true;
        await D.openBook(it.id);
      });
      row.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        try {
          var rec = JSON.parse(localStorage.getItem('moyu.recent') || '[]').filter(function (x) { return x.id !== it.id; });
          localStorage.setItem('moyu.recent', JSON.stringify(rec));
        } catch (err) {}
        paintHistory();
      });
      listEl.appendChild(row);
    });
  }

  function toggleHistory() {
    if (panel.hidden) { closeOthers(panel); paintHistory(); panel.hidden = false; }
    else panel.hidden = true;
  }

  document.addEventListener('click', function (e) {
    if (panel.hidden) return;
    if (!panel.contains(e.target) && e.target.id !== 'tbHistory') panel.hidden = true;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.hidden = true; });

  /* ── 綁頂欄按鈕（chrome.js 重建後才存在）── */
  function bind() {
    var homeBtn = document.querySelector('#tbHome');
    if (homeBtn && !homeBtn.dataset.bound) { homeBtn.dataset.bound = '1'; homeBtn.addEventListener('click', openHome); }
    var histBtn = document.querySelector('#tbHistory');
    if (histBtn && !histBtn.dataset.bound) { histBtn.dataset.bound = '1'; histBtn.addEventListener('click', toggleHistory); }
  }
  bind();
  new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });

  window.__moyuShell = { openHome: openHome, toggleHistory: toggleHistory, recentList: recentList };
})();
`;
  fs.writeFileSync(p('ui/shell.js'), src, 'utf8');
  console.log('ui/shell.js ok');
}

/* ── chrome.js：加首頁 / 歷史兩顆 ─────────────────────────── */
{
  const f = p('ui/chrome.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("tbHome")) {
    must(s, "  const setBtn = mk('tbSettings', 'settings', '設定');", 'chrome settings btn');
    s = s.replace(
      "  const setBtn = mk('tbSettings', 'settings', '設定');",
      "  const homeBtn2 = mk('tbHome', 'home', '首頁');\n"
      + "  const histBtn2 = mk('tbHistory', 'history', '歷史');\n"
      + "  const setBtn = mk('tbSettings', 'settings', '設定');"
    );
    must(s, "  right.appendChild(setBtn);", 'chrome append settings');
    s = s.replace(
      "  right.appendChild(setBtn);",
      "  right.appendChild(homeBtn2);\n  right.appendChild(histBtn2);\n  right.appendChild(setBtn);"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('chrome.js ok');
  } else console.log('chrome.js 已有 tbHome');
}

/* ── index.html：載入 shell.js ───────────────────────────── */
{
  const f = p('ui/index.html');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('src="shell.js"')) {
    must(s, '<script src="layout.js"></script>', 'index layout script');
    s = s.replace('<script src="layout.js"></script>',
      '<script src="layout.js"></script>\n<script src="shell.js"></script>');
    fs.writeFileSync(f, s, 'utf8');
    console.log('index.html ok');
  } else console.log('index.html 已有 shell.js');
}

/* ── pack4 ───────────────────────────────────────────────── */
{
  const f = p('tools/pack4.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("'ui/shell.js'")) {
    must(s, "'ui/layout.js'", 'pack layout');
    s = s.replace("'ui/layout.js'", "'ui/layout.js', 'ui/shell.js'");
    fs.writeFileSync(f, s, 'utf8');
    console.log('pack4.js ok');
  } else console.log('pack4.js 已有 shell.js');
}
