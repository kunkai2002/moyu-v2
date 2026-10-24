/* 魔芋一夏 · 自製 SVG 圖標集
   規則：24×24、stroke 1.6、圓頭、currentColor（跟主題走，不寫死顏色）。 */
(function () {
  'use strict';

  const P = {
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    forward: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    shelf: '<path d="M4 5.5h4.5v13H4zM9.5 5.5H14v13H9.5zM15 7l4 11.5"/><path d="M15.6 6.6 19 5.7"/>',
    search: '<circle cx="10.8" cy="10.8" r="5.8"/><path d="m15.2 15.2 4 4"/>',
    bookmark: '<path d="M6.5 4.5h11v15l-5.5-4-5.5 4z"/>',
    chart: '<path d="M4 19.5V15M9.3 19.5V9M14.6 19.5v-6.5M20 19.5V5.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
    more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    down: '<path d="M12 4v11M7.5 11l4.5 4.5L16.5 11"/><path d="M4.5 19.5h15"/>',
    upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5"/><path d="M4.5 19.5h15"/>',
    list: '<path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h10"/>',
    comment: '<path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-5.5l-4.5 3.5v-3.5h-1a2 2 0 0 1-2-2z"/>',
    history: '<path d="M12 7.5V12l3 2"/><circle cx="12" cy="12" r="8"/>',
    shield: '<path d="M12 3.5 5 6.5v5c0 4.5 3 7.6 7 8.2 4-.6 7-3.7 7-8.2v-5z"/>',
    focus: '<path d="M4 8.5V4.5h4M20 8.5v-4h-4M4 15.5v4h4M20 15.5v4h-4"/>',
    book: '<path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3z"/><path d="M5 4.5v15"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    trash: '<path d="M5 7h14M9.5 7V4.5h5V7M7 7l1 12.5h8L17 7"/>',
    note: '<path d="M5.5 4.5h9l4 4v11h-13z"/><path d="M14.5 4.5v4h4"/><path d="M8.5 13h6M8.5 16.5h4"/>',
  };

  function svg(name, size) {
    const d = P[name];
    if (!d) return '';
    const s = size || 18;
    const filled = /fill="currentColor"/.test(d);
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      ${filled ? '' : 'stroke-linejoin="round"'}>${d}</svg>`;
  }

  window.MOYU_ICONS = { svg, set: P };
})();
