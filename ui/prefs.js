/* 設定持久化：localStorage 的 moyu.* 全部鏡像到 data/prefs.json。
   順序：先把檔案裡的偏好補回 localStorage，再讓後面的腳本照常讀。 */
(function () {
  'use strict';
  var NS = 'moyu.';
  var bridge = window.moyu;

  function readAll() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(NS) === 0) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }

  /* 1. 開機還原：只補本機缺的，不覆蓋當前值 */
  try {
    var saved = bridge && bridge.prefs ? bridge.prefs.read() : null;
    if (saved && typeof saved === 'object') {
      for (var k in saved) {
        if (k.indexOf(NS) !== 0) continue;
        try { if (localStorage.getItem(k) === null) localStorage.setItem(k, saved[k]); } catch (e) {}
      }
    }
  } catch (e) {}

  /* 2. 之後每次變動都寫回檔案 */
  var timer = null;
  function flush() {
    try { if (bridge && bridge.prefs) bridge.prefs.write(readAll()); } catch (e) {}
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 300); }

  try {
    var rawSet = localStorage.setItem.bind(localStorage);
    var rawDel = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (k, v) { rawSet(k, v); if (k && k.indexOf(NS) === 0) schedule(); };
    localStorage.removeItem = function (k) { rawDel(k); if (k && k.indexOf(NS) === 0) schedule(); };
  } catch (e) {}

  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  setInterval(flush, 5000);

  window.__moyuPrefs = { read: readAll, flush: flush };
})();
