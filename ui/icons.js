/* 魔芋一夏 · 圖標集 v2
   設計原則：24 視框、視覺重量輕、只留必要筆畫、統一 1.7 描邊、避免大面積填色。 */
(function () {
  'use strict';

  const P = {
    /* 導航 */
    back:    '<path d="M14.8 5.2 8 12l6.8 6.8"/>',
    forward: '<path d="M9.2 5.2 16 12l-6.8 6.8"/>',
    chevronDown: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',

    /* 主要功能 */
    shelf:   '<path d="M5 5.5h3.2v13H5z"/><path d="M10.2 5.5h3.2v13h-3.2z"/><path d="m15.6 6.6 2.9.8-2.5 11.1-2.9-.8z"/>',
    search:  '<circle cx="11" cy="11" r="5.6"/><path d="m15.3 15.3 4.2 4.2"/>',
    bookmark:'<path d="M7 4.8h10a.6.6 0 0 1 .6.6v14.2L12 15.4l-5.6 4.2V5.4a.6.6 0 0 1 .6-.6z"/>',
    chart:   '<path d="M5 19.2V14"/><path d="M10 19.2V8.6"/><path d="M15 19.2v-7.4"/><path d="M20 19.2V5"/>',
    settings:'<circle cx="12" cy="12" r="2.8"/><path d="M12 4.2v2.1M12 17.7v2.1M4.2 12h2.1M17.7 12h2.1"/>',
    more:    '<circle cx="6.2" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="17.8" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
    close:   '<path d="M6.8 6.8 17.2 17.2M17.2 6.8 6.8 17.2"/>',
    check:   '<path d="m5.6 12.4 4.3 4.3 8.5-9"/>',

    /* 內容 */
    book:    '<path d="M6 4.8h8.4a2.6 2.6 0 0 1 2.6 2.6v11.8H8.6A2.6 2.6 0 0 0 6 21.8z"/><path d="M6 4.8v17"/>',
    list:    '<path d="M5 7h1.4M5 12h1.4M5 17h1.4"/><path d="M9.4 7h9.6M9.4 12h9.6M9.4 17h6.2"/>',
    download:'<path d="M12 4.5v10"/><path d="m7.8 10.4 4.2 4.2 4.2-4.2"/><path d="M4.8 19h14.4"/>',
    upload:  '<path d="M12 15V5"/><path d="m7.8 9 4.2-4.2L16.2 9"/><path d="M4.8 19h14.4"/>',
    comment: '<path d="M5 6.2A1.7 1.7 0 0 1 6.7 4.5h10.6A1.7 1.7 0 0 1 19 6.2v6.4a1.7 1.7 0 0 1-1.7 1.7h-5.2L7.6 18v-3.7H6.7A1.7 1.7 0 0 1 5 12.6z"/>',
    note:    '<path d="M6.4 4.8h7.2l4 4v10.4H6.4z"/><path d="M13.6 4.8v4h4"/>',
    history: '<circle cx="12" cy="12" r="7.6"/><path d="M12 7.8V12l2.8 1.9"/>',
    shield:  '<path d="M12 4 6 6.4v4.9c0 4 2.7 6.8 6 7.5 3.3-.7 6-3.5 6-7.5V6.4z"/>',
    focus:   '<path d="M4.5 8.8V4.5h4.3"/><path d="M19.5 8.8V4.5h-4.3"/><path d="M4.5 15.2v4.3h4.3"/><path d="M19.5 15.2v4.3h-4.3"/>',
    trash:   '<path d="M5.2 7h13.6"/><path d="M9.6 7V5.2h4.8V7"/><path d="M7.2 7 8 19.2h8L16.8 7"/>',
    font:    '<path d="M6 18.5 12 5.5l6 13"/><path d="M8.6 13.6h6.8"/>',
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
