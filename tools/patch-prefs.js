// 設定持久化：所有 UI 設定同步存到 data/prefs.json，更新／重裝後自動還原
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── main.js：prefs 讀寫（同步）──────────────────────────── */
{
  const f = 'main.js';
  let s = rd(f);
  must(s, "  ipcMain.handle('config:get', () => ({", 'config:get');
  s = s.replace(
    "  ipcMain.handle('config:get', () => ({",
    `  /* 偏好設定：存在 data/prefs.json，重裝或換版都還在 */
  const prefsPath = () => path.join(DATA_DIR, 'prefs.json');

  ipcMain.on('prefs:read', (e) => {
    try { e.returnValue = store.readJson(prefsPath(), {}); } catch { e.returnValue = {}; }
  });

  ipcMain.on('prefs:write', (_e, obj) => {
    try {
      if (obj && typeof obj === 'object') store.writeJson(prefsPath(), obj);
    } catch {}
  });

  ipcMain.handle('config:get', () => ({`
  );
  wr(f, s);
  console.log('main.js ok');
}

/* ── preload.js ───────────────────────────────────────────── */
{
  const f = 'ui/preload.js';
  let s = rd(f);
  must(s, "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),", 'preload copy');
  s = s.replace(
    "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),",
    "  prefs: {\n"
    + "    read: () => ipcRenderer.sendSync('prefs:read'),\n"
    + "    write: (obj) => ipcRenderer.send('prefs:write', obj),\n"
    + "  },\n"
    + "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),"
  );
  wr(f, s);
  console.log('preload.js ok');
}

/* ── ui/prefs.js（第一個載入）────────────────────────────── */
{
  const src = `/* 設定持久化：localStorage 的 moyu.* 全部鏡像到 data/prefs.json。
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
`;
  fs.writeFileSync(p('ui/prefs.js'), src, 'utf8');
  console.log('ui/prefs.js ok');
}

/* ── index.html：prefs.js 放最前 ─────────────────────────── */
{
  const f = 'ui/index.html';
  let s = rd(f);
  if (!s.includes('src="prefs.js"')) {
    must(s, '<script src="icons.js"></script>', 'index icons script');
    s = s.replace('<script src="icons.js"></script>', '<script src="prefs.js"></script>\n<script src="icons.js"></script>');
    wr(f, s);
    console.log('index.html ok');
  } else console.log('index.html 已含 prefs.js');
}

/* ── wiring.js：滑桿設定同步到 settings.json（正確的鍵名）── */
{
  const f = 'ui/wiring.js';
  let s = rd(f);
  const oldSet = "      window.moyu?.config?.set?.({ [key === 'font' ? 'fontScale' : key]: n });";
  if (s.includes(oldSet)) {
    s = s.replace(oldSet, "      window.moyu?.config?.set?.({ [CONFIG_KEY[key] || key]: n });");
    must(s, "  function bindRange(id, label, key, def, apply) {", 'bindRange');
    s = s.replace(
      "  function bindRange(id, label, key, def, apply) {",
      "  const CONFIG_KEY = { font: 'fontSize', lh: 'lineHeight', speed: 'streamSpeed' };\n"
      + "  function bindRange(id, label, key, def, apply) {"
    );
    wr(f, s);
    console.log('wiring.js ok');
  } else console.log('wiring.js 已改過');
}

/* ── pack4.js ─────────────────────────────────────────────── */
{
  const f = 'tools/pack4.js';
  let s = rd(f);
  if (!s.includes("'ui/prefs.js'")) {
    must(s, "'ui/icons.js'", 'pack icons');
    s = s.replace("'ui/icons.js'", "'ui/prefs.js', 'ui/icons.js'");
    wr(f, s);
    console.log('pack4.js ok');
  } else console.log('pack4.js 已含 prefs.js');
}
