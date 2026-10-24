/* 動效：克制、短、只做透明度與 2–6px 位移
   原則：不彈跳、不旋轉、不超過 220ms、尊重 prefers-reduced-motion */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  const css = document.createElement('style');
  css.textContent = `
  :root{
    --ease:cubic-bezier(.2,.7,.3,1);
    --t-fast:120ms; --t-mid:180ms; --t-slow:220ms;
  }

  /* 全域：只過渡顏色與邊框，避免版面重排 */
  button, .pill, .tb-btn, .cn-btn, .ov-row, .ctx-row, .ch, .dt-btn, .mk-row, .rc-row, .grep-row {
    transition: background-color var(--t-fast) var(--ease),
                color var(--t-fast) var(--ease),
                border-color var(--t-fast) var(--ease),
                opacity var(--t-fast) var(--ease);
  }

  /* 面板：淡入 + 上移 4px */
  @keyframes moyuFadeUp{ from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:none} }
  @keyframes moyuFade{ from{opacity:0} to{opacity:1} }
  .panel:not([hidden]), .marks-panel:not([hidden]), .stats-panel:not([hidden]),
  .detail:not([hidden]), .overflow:not([hidden]), .recent-menu:not([hidden]){
    animation: moyuFadeUp var(--t-slow) var(--ease) both;
    will-change: opacity, transform;
  }
  .ctx.on{ animation: moyuFade var(--t-fast) var(--ease) both }

  /* 更新提示條：滑入 */
  @keyframes moyuSlide{ from{opacity:0; transform:translateY(-6px)} to{opacity:1; transform:none} }
  .upd-bar:not([hidden]){ animation: moyuSlide var(--t-mid) var(--ease) both }

  /* 正文：段落淡入（一次全部顯示時，只做極輕微錯位） */
  @keyframes moyuPara{ from{opacity:0; transform:translateY(3px)} to{opacity:1; transform:none} }
  #stream .p{ animation: moyuPara var(--t-mid) var(--ease) both }

  /* 章節切換：整段淡入 */
  @keyframes moyuThread{ from{opacity:0} to{opacity:1} }
  .thread.moyu-swap{ animation: moyuThread var(--t-mid) var(--ease) both }

  /* 卡片 hover：抬 1px（不用 scale，避免文字模糊） */
  .shelf-card, .dt-btn, .cn-btn{ transition: transform var(--t-fast) var(--ease),
      background-color var(--t-fast) var(--ease),
      border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease) }
  .shelf-card:hover{ transform: translateY(-1px) }

  /* 按下回饋 */
  .tb-btn:active, .cn-btn:active, .dt-btn:active, .pill:active{ transform: translateY(1px); opacity:.85 }

  /* 章節列選取指示條 */
  .ch::before{ transition: opacity var(--t-fast) var(--ease) }

  /* 進度條 / 統計長條 */
  .st-bar{ transition: height var(--t-mid) var(--ease), opacity var(--t-fast) var(--ease) }

  /* 載入中的骨架感（用在 .meta 的「讀取中」） */
  @keyframes moyuPulse{ 0%,100%{opacity:.45} 50%{opacity:.85} }
  #stream .meta{ animation: moyuFade var(--t-mid) var(--ease) both }

  /* 尊重系統設定 */
  @media (prefers-reduced-motion: reduce){
    *, *::before, *::after{
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
    }
  }
  `;
  document.head.appendChild(css);

  /* 章節切換時給對話流一個淡入（不動版面） */
  const stream = $('#stream');
  if (stream) {
    let lastKey = '';
    new MutationObserver(() => {
      const crumb = $('#crumb')?.textContent || '';
      if (crumb === lastKey) return;
      lastKey = crumb;
      const t = stream.querySelector('.thread');
      if (!t) return;
      t.classList.remove('moyu-swap');
      void t.offsetWidth;          // 強制重排，讓動畫重跑
      t.classList.add('moyu-swap');
    }).observe(stream, { childList: true, subtree: true });
  }
})();
