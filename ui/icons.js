/* 魔芋一夏 · 圖標集 v3
   設計語言：純幾何、不擬物、24 視框、1.7 描邊、圓頭。
   小尺寸（16px）優先辨識度。 */
(function () {
  'use strict';

  const P = {
    /* 導航 */
    back:    '<path d="M14.8 5.2 8 12l6.8 6.8"/>',
    forward: '<path d="M9.2 5.2 16 12l-6.8 6.8"/>',
    chevronDown: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',

    /* 主要功能 */
    /* 三本等高、直立，第三本略斜 —— 一致性優先 */
    shelf:   '<path d="M4.5 4.8h3.4v14.4H4.5z"/><path d="M9.4 4.8h3.4v14.4H9.4z"/><path d="m14.9 6.2 3.2-.9 3.4 13.1-3.2.9z"/>',
    search:  '<circle cx="11" cy="11" r="5.6"/><path d="m15.3 15.3 4.2 4.2"/>',
    bookmark:'<path d="M7 4.8h10a.6.6 0 0 1 .6.6v14.2L12 15.4l-5.6 4.2V5.4a.6.6 0 0 1 .6-.6z"/>',
    /* 柱子等高差距收斂，重心平均 */
    chart:   '<path d="M5 19.4v-4.2M10 19.4V9.4M15 19.4v-6.6M20 19.4V6.2"/>',
    /* 滑桿式設定：小尺寸最易辨識 */
    settings:'<path d="M4 7.2h3.2M10.4 7.2h9.6"/><path d="M4 12h8.6M15.8 12h4.2"/><path d="M4 16.8h4.6M12 16.8h8"/><circle cx="8.8" cy="7.2" r="1.7"/><circle cx="14.2" cy="12" r="1.7"/><circle cx="10.4" cy="16.8" r="1.7"/>',
    /* 點放大一點，跟線條等重 */
    more:    '<circle cx="5.8" cy="12" r="1.45" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.45" fill="currentColor" stroke="none"/><circle cx="18.2" cy="12" r="1.45" fill="currentColor" stroke="none"/>',
    close:   '<path d="M6.8 6.8 17.2 17.2M17.2 6.8 6.8 17.2"/>',
    check:   '<path d="m5.6 12.4 4.3 4.3 8.5-9"/>',

    /* 內容 */
    /* 攤開的書：兩頁 + 書脊，跟 note 明顯區隔 */
    book:    '<path d="M12 6.6c-1.9-1.35-4.4-1.55-6.6-.85v11.2c2.2-.7 4.7-.5 6.6.85 1.9-1.35 4.4-1.55 6.6-.85V5.75c-2.2-.7-4.7-.5-6.6.85z"/><path d="M12 6.6v11.2"/>',
    /* 三條等長橫線 —— 最穩的列表語義 */
    list:    '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
    download:'<path d="M12 4.5v10"/><path d="m7.8 10.4 4.2 4.2 4.2-4.2"/><path d="M4.8 19h14.4"/>',
    upload:  '<path d="M12 15V5"/><path d="m7.8 9 4.2-4.2L16.2 9"/><path d="M4.8 19h14.4"/>',
    comment: '<path d="M5 6.2A1.7 1.7 0 0 1 6.7 4.5h10.6A1.7 1.7 0 0 1 19 6.2v6.4a1.7 1.7 0 0 1-1.7 1.7h-5.2L7.6 18v-3.7H6.7A1.7 1.7 0 0 1 5 12.6z"/>',
    note:    '<path d="M6.4 4.8h7.2l4 4v10.4H6.4z"/><path d="M13.6 4.8v4h4"/><path d="M9 13h6M9 16.4h4"/>',
    history: '<circle cx="12" cy="12" r="7.6"/><path d="M12 7.8V12l2.8 1.9"/>',
    shield:  '<path d="M12 4 6 6.4v4.9c0 4 2.7 6.8 6 7.5 3.3-.7 6-3.5 6-7.5V6.4z"/>',
    focus:   '<path d="M4.5 8.8V4.5h4.3"/><path d="M19.5 8.8V4.5h-4.3"/><path d="M4.5 15.2v4.3h4.3"/><path d="M19.5 15.2v4.3h-4.3"/>',
    trash:   '<path d="M5.2 7h13.6"/><path d="M9.6 7V5.2h4.8V7"/><path d="M7.2 7 8 19.2h8L16.8 7"/>',
    font:    '<path d="M6 18.5 12 5.5l6 13"/><path d="M8.9 13.2h6.2"/>',
    auto:    '<path d="M8.2 6.2 17 12l-8.8 5.8z"/>',
    pause:   '<path d="M9 6v12M15 6v12"/>',
  };

  function svg(name, size) {
    const d = P[name];
    if (!d) return '';
    const s = size || 16;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  }

  window.MOYU_ICONS = { svg, set: P };
})();
