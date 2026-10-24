/* 第三批接線：Electron 無邊框視窗的自訂標題列（只在 Electron 模式注入） */
(function () {
  'use strict';
  const bridge = window.moyu;
  if (!bridge || !bridge.win) return;      // Chrome 模式不注入

  const css = document.createElement('style');
  css.textContent = `
  .titlebar{
    height:30px;flex:none;display:flex;align-items:center;gap:10px;
    padding:0 0 0 12px;background:var(--bg-side);border-bottom:1px solid var(--line);
    -webkit-app-region:drag;font-size:11px;color:var(--fg3);user-select:none;
  }
  .titlebar .tb-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .titlebar .tb-btns{display:flex;-webkit-app-region:no-drag;height:100%}
  .titlebar .tb-btn{
    width:44px;height:100%;display:grid;place-items:center;
    background:none;border:0;color:var(--fg3);cursor:pointer;
  }
  .titlebar .tb-btn:hover{background:var(--sel);color:var(--fg)}
  .titlebar .tb-btn.close:hover{background:#c0392b;color:#fff}
  `;
  document.head.appendChild(css);

  const bar = document.createElement('div');
  bar.className = 'titlebar';
  bar.innerHTML = `
    <span class="tb-title" id="tbTitle"></span>
    <span class="tb-btns">
      <button class="tb-btn" id="tbMin" title="最小化"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" stroke-width="1.4"/></svg></button>
      <button class="tb-btn" id="tbMax" title="最大化"><svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
      <button class="tb-btn close" id="tbClose" title="關閉（收到托盤）"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.4"/></svg></button>
    </span>`;
  document.body.insertBefore(bar, document.body.firstChild);

  const t = document.getElementById('tbTitle');
  if (t) t.textContent = document.title;

  document.getElementById('tbMin')?.addEventListener('click', () => bridge.win.min());
  document.getElementById('tbMax')?.addEventListener('click', () => bridge.win.max());
  document.getElementById('tbClose')?.addEventListener('click', () => bridge.win.close());
})();
