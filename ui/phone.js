/* 手機版：給一組可複製的網址，並把登入態推上雲端 */
(function () {
  'use strict';
  var D = window.__moyuDebug;
  var B = window.moyu;
  var $ = function (s) { return document.querySelector(s); };
  if (!D || !B) return;

  var css = document.createElement('style');
  css.textContent = [
    '.phone-panel{position:absolute;right:18px;top:44px;bottom:34px;width:360px;z-index:46;',
    '  background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;',
    '  box-shadow:0 18px 50px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden}',
    '.phone-panel[hidden]{display:none}',
    '.phone-body{flex:1;overflow:auto;padding:12px 14px;font-size:12.5px;color:var(--fg2);line-height:1.7}',
    '.phone-body h4{margin:14px 0 6px;font-size:11px;color:var(--fg3);font-weight:500;letter-spacing:.5px}',
    '.phone-url{display:flex;gap:6px;margin-top:4px}',
    '.phone-url input{flex:1;min-width:0;background:var(--bg);border:1px solid var(--line-strong);border-radius:6px;',
    '  color:var(--fg);font:inherit;font-size:11.5px;padding:7px 8px;outline:0}',
    '.phone-btn{border:1px solid var(--line-strong);border-radius:6px;padding:6px 10px;font-size:12px;background:var(--bg-elev);color:var(--fg2)}',
    '.phone-btn:hover{border-color:var(--acc);color:var(--fg)}',
    '.phone-btn.primary{background:var(--acc);border-color:var(--acc);color:#fff}',
    '.phone-note{color:var(--fg3);font-size:11px;margin-top:6px}',
    '.phone-step{display:flex;gap:8px;margin:6px 0}',
    '.phone-step b{color:var(--fg3);font-weight:500;flex:none}',
  ].join('\n');
  document.head.appendChild(css);

  var panel = document.createElement('div');
  panel.className = 'phone-panel';
  panel.hidden = true;
  panel.innerHTML = '<div class="panel-head"><b>手機</b>'
    + '<button class="ghost icon" id="phClose" title="關閉">' + (window.MOYU_ICONS ? window.MOYU_ICONS.svg('close', 14) : '×') + '</button></div>'
    + '<div class="phone-body">'
    + '<h4>手機網址</h4>'
    + '<div class="phone-url"><input id="phUrl" readonly><button class="phone-btn" id="phCopy">複製</button></div>'
    + '<div class="phone-note" id="phState">讀取中…</div>'
    + '<h4>第一次使用</h4>'
    + '<div class="phone-step"><b>1</b><span>按下面的「同步登入態」，把番茄登入 cookie 送到雲端。</span></div>'
    + '<div class="phone-step"><b>2</b><span>用手機打開上面那個網址，加進主畫面。</span></div>'
    + '<div class="phone-step"><b>3</b><span>之後手機讀到哪裡、桌面會同步，反之亦然。</span></div>'
    + '<div style="margin-top:14px"><button class="phone-btn primary" id="phSetup">同步登入態到雲端</button></div>'
    + '</div>';
  document.querySelector('.main')?.appendChild(panel);

  var urlEl = panel.querySelector('#phUrl');
  var stateEl = panel.querySelector('#phState');

  function closeOthers(except) {
    document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail, .hist-panel, .phone-panel')
      .forEach(function (el) { if (el !== except && el !== panel) el.hidden = true; });
  }

  async function refresh() {
    try {
      if (!B.sync || !B.sync.status) {
        stateEl.textContent = '這個版本還沒接上同步，請更新後再試';
        return;
      }
      var st = await B.sync.status();
      if (!st || !st.configured) {
        stateEl.textContent = '還沒設定同步（設定 → 同步，填網址與金鑰）';
        urlEl.value = '';
        return;
      }
      var tok = '';
      try { tok = (await B.prefs?.read?.())?.['moyu.syncToken'] || ''; } catch (e) {}
      // 金鑰放在主程序，這裡只拿得到有沒有設定；用 setup 回應補
      var r = await B.sync.setup?.();
      var base = (r && r.url) || st.url || '';
      urlEl.value = (r && r.phoneUrl) || (base ? base.replace(/\/$/, '') + '/m/' : '');
      stateEl.textContent = '登入態：' + (r && r.ok ? '已同步到雲端' : ((r && r.error) || '尚未同步'));
    } catch (e) {
      stateEl.textContent = '讀取失敗：' + e.message;
    }
  }

  panel.querySelector('#phClose').addEventListener('click', function () { panel.hidden = true; });
  panel.querySelector('#phCopy').addEventListener('click', async function () {
    if (!urlEl.value) return;
    try {
      if (B.copyPlain) await B.copyPlain(urlEl.value); else await navigator.clipboard.writeText(urlEl.value);
      stateEl.textContent = '網址已複製';
    } catch (e) { stateEl.textContent = '複製失敗：' + e.message; }
  });
  panel.querySelector('#phSetup').addEventListener('click', async function () {
    stateEl.textContent = '同步中…';
    var r = await B.sync.setup?.();
    stateEl.textContent = r && r.ok ? '登入態已同步到雲端' : ('失敗：' + ((r && r.error) || '未知'));
    refresh();
  });

  function toggle() {
    if (panel.hidden) { closeOthers(panel); panel.hidden = false; refresh(); }
    else panel.hidden = true;
  }

  document.addEventListener('click', function (e) {
    if (panel.hidden) return;
    // 從「更多」選單點進來的同一個 click 事件會冒泡到這裡，
    // 不排除的話面板一開就被自己關掉
    if (e.target.closest && e.target.closest('.overflow')) return;
    if (e.target.id === 'tbPhone' || e.target.closest('#tbPhone')) return;
    if (!panel.contains(e.target)) panel.hidden = true;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.hidden = true; });

  /* 自己綁按鈕：不依賴別的檔案的初始化順序 */
  function bindBtn() {
    var b = document.getElementById('tbPhone');
    if (!b || b.dataset.phoneBound) return;
    b.dataset.phoneBound = '1';
    b.addEventListener('click', toggle);
  }
  bindBtn();
  new MutationObserver(bindBtn).observe(document.body, { childList: true, subtree: true });

  window.__moyuPhone = { toggle: toggle };
})();
