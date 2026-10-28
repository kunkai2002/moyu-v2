/* 版面：小視窗、目錄拖寬、面板拖寬、輸入框拖高 */
(function () {
  'use strict';
  var root = document.documentElement;
  var app = document.querySelector('.app');
  var side = document.querySelector('.side');
  if (!app || !side) return;

  var css = document.createElement('style');
  css.textContent = [
    /* 目錄右緣：一定要在正文之上才抓得到 */
    '.side{position:relative;z-index:3}',
    '.main{position:relative;z-index:1}',
    '.side .rz{right:0;width:8px;z-index:40}',

    /* 面板左右拖寬 */
    '.panel-rz{position:absolute;left:0;top:0;bottom:0;width:7px;cursor:col-resize;z-index:5}',
    '.panel-rz:hover{background:var(--acc)}',

    /* 輸入框上方拖高 */
    '.input-rz{height:6px;cursor:row-resize;margin:2px 0 0;border-radius:3px}',
    '.input-rz:hover{background:var(--acc)}',
    '#input{max-height:none}',

    /* 小視窗：目錄變抽屜（收起來時不准留陰影，左邊那條陰影沒有人看得懂） */
    '@media (max-width: 760px){',
    '  .side{position:absolute;left:0;top:0;bottom:0;width:min(86vw,var(--side-w));',
    '    transform:translateX(-101%);transition:transform 180ms cubic-bezier(.2,.7,.3,1);',
    '    box-shadow:none}',
    '  .app.side-open .side{transform:none;box-shadow:14px 0 40px rgba(0,0,0,.45)}',
    '  .side .rz{display:none}',
    '  .side-toggle{display:grid!important}',
    '  .tb-btn{padding:3px 4px}',
    '  .panel,.marks-panel,.stats-panel,.detail{width:min(94vw,420px)!important}',
    '  .crumb{font-size:11.5px}',
    '}',
    '.side-toggle{display:none;position:fixed;left:8px;top:8px;z-index:60;width:26px;height:26px;',
    '  place-items:center;border:1px solid var(--line);border-radius:6px;',
    '  background:var(--bg-elev);color:var(--fg2)}',
    '.side-toggle:hover{color:var(--fg)}',
  ].join('\n');
  document.head.appendChild(css);

  /* ── 目錄左右拖（原本的 handle 修好）── */
  var rz = side.querySelector('.rz');
  if (!rz) { rz = document.createElement('div'); rz.className = 'rz'; rz.title = '拖曳調整寬度'; side.appendChild(rz); }
  var savedW = Number(localStorage.getItem('moyu.sideW') || 0);
  if (savedW >= 160) root.style.setProperty('--side-w', savedW + 'px');

  var dragging = false;
  rz.addEventListener('mousedown', function (e) {
    dragging = true; e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var w = Math.max(150, Math.min(window.innerWidth * 0.7, e.clientX));
    root.style.setProperty('--side-w', w + 'px');
  });
  window.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    var w = parseInt(getComputedStyle(root).getPropertyValue('--side-w'), 10);
    if (w) localStorage.setItem('moyu.sideW', String(w));
  });
  rz.addEventListener('dblclick', function () {
    root.style.removeProperty('--side-w');
    localStorage.removeItem('moyu.sideW');
  });

  /* ── 小視窗：目錄抽屜開關 ── */
  var toggle = document.createElement('button');
  toggle.className = 'side-toggle';
  toggle.title = '目錄';
  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  document.body.appendChild(toggle);
  toggle.addEventListener('click', function () { app.classList.toggle('side-open'); });
  document.addEventListener('click', function (e) {
    if (!app.classList.contains('side-open')) return;
    if (side.contains(e.target) || toggle.contains(e.target)) return;
    app.classList.remove('side-open');
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') app.classList.remove('side-open');
  });

  /* ── 右側面板拖寬 ── */
  var PANELS = '.panel, .marks-panel, .stats-panel, .detail';
  var panelW = Number(localStorage.getItem('moyu.panelW') || 0);
  function makeResizable(el) {
    if (!el || el.dataset.rzDone) return;
    el.dataset.rzDone = '1';
    if (getComputedStyle(el).position === 'static') el.style.position = 'absolute';
    var h = document.createElement('div');
    h.className = 'panel-rz';
    h.title = '拖曳調整寬度（雙擊還原）';
    el.appendChild(h);
    if (panelW >= 260) el.style.width = panelW + 'px';
    var on = false;
    h.addEventListener('mousedown', function (e) {
      on = true; e.preventDefault(); e.stopPropagation();
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', function (e) {
      if (!on) return;
      var w = Math.max(240, Math.min(window.innerWidth - 80, window.innerWidth - e.clientX));
      el.style.width = w + 'px';
    });
    window.addEventListener('mouseup', function () {
      if (!on) return;
      on = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('moyu.panelW', String(parseInt(el.style.width, 10) || 0));
    });
    h.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      el.style.removeProperty('width');
      localStorage.removeItem('moyu.panelW');
    });
  }
  function sweepPanels() {
    document.querySelectorAll(PANELS).forEach(makeResizable);
  }
  sweepPanels();
  new MutationObserver(sweepPanels).observe(document.body, { childList: true, subtree: true });

  /* ── 輸入框上方拖高 ── */
  var input = document.querySelector('#input');
  if (input) {
    var ih = Number(localStorage.getItem('moyu.inputH') || 0);
    if (ih >= 40) input.style.height = ih + 'px';
    var handle = document.createElement('div');
    handle.className = 'input-rz';
    handle.title = '拖曳調整輸入框高度（雙擊還原）';
    var box = input.closest('.box-line') || input.parentElement;
    box.parentElement.insertBefore(handle, box);
    var onH = false;
    handle.addEventListener('mousedown', function (e) {
      onH = true; e.preventDefault();
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', function (e) {
      if (!onH) return;
      var r = box.getBoundingClientRect();
      var h = Math.max(38, Math.min(window.innerHeight * 0.6, r.bottom - e.clientY));
      input.style.height = h + 'px';
    });
    window.addEventListener('mouseup', function () {
      if (!onH) return;
      onH = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('moyu.inputH', String(parseInt(input.style.height, 10) || 0));
    });
    handle.addEventListener('dblclick', function () {
      input.style.removeProperty('height');
      localStorage.removeItem('moyu.inputH');
    });
  }

  window.__moyuLayout = {
    get sideW() { return getComputedStyle(root).getPropertyValue('--side-w').trim(); },
    get panelW() { return localStorage.getItem('moyu.panelW'); },
    get inputH() { return input ? input.style.height : ''; },
  };
})();
