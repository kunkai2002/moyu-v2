// ① /m/ 指向 index.html ② 桌面版「手機」面板：網址 + 一鍵同步登入態
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── build-mobile-assets.js：補 /m/ ─────────────────────── */
{
  const f = p('tools/build-mobile-assets.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("map['/m/']")) {
    must(s, "map['/m'] = null; // 由 Worker 轉址", 'assets map');
    s = s.replace(
      "map['/m'] = null; // 由 Worker 轉址",
      "map['/m'] = null; // 由 Worker 轉址\nmap['/m/'] = map['/m/index.html'];"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('build-mobile-assets.js ok');
  } else console.log('build 已含 /m/');
}

/* ── main.js：sync:setup（把手機需要的 cookie 推上 Worker）── */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('sync:setup')) {
    must(s, "  ipcMain.handle('sync:push', async () => {", 'main sync push');
    s = s.replace(
      "  ipcMain.handle('sync:push', async () => {",
      `  ipcMain.handle('sync:setup', async () => {
    const st = syncer.status();
    if (!st.configured) return { ok: false, error: '還沒設定同步（網址 / 金鑰）' };
    const cookie = cookieHeader();
    if (!cookie) return { ok: false, error: '還沒登入，先掃碼' };
    try {
      const r = await fetch(st.url + '/setup', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (st.token || ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie }),
      });
      const j = await r.json().catch(() => ({}));
      return { ok: !!j.ok, ...j, url: st.url };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('sync:push', async () => {`
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js ok');
  } else console.log('main.js 已有 sync:setup');
}

/* ── preload ─────────────────────────────────────────────── */
{
  const f = p('ui/preload.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('setup:')) {
    must(s, "    push: () => ipcRenderer.invoke('sync:push'),", 'preload sync push');
    s = s.replace(
      "    push: () => ipcRenderer.invoke('sync:push'),",
      "    push: () => ipcRenderer.invoke('sync:push'),\n    setup: () => ipcRenderer.invoke('sync:setup'),"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('preload.js ok');
  } else console.log('preload.js 已有 setup');
}

/* ── ui/phone.js：手機面板 ───────────────────────────────── */
{
  const src = `/* 手機版：給一組可複製的網址，並把登入態推上雲端 */
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
  ].join('\\n');
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
      urlEl.value = base ? base.replace(/\\/$/, '') + '/m/' : '';
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
    if (!panel.contains(e.target) && e.target.id !== 'tbPhone') panel.hidden = true;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.hidden = true; });

  window.__moyuPhone = { toggle: toggle };
})();
`;
  fs.writeFileSync(p('ui/phone.js'), src, 'utf8');
  console.log('ui/phone.js ok');
}

/* ── chrome.js：加手機按鈕 ───────────────────────────────── */
{
  const f = p('ui/chrome.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('tbPhone')) {
    must(s, "  const setBtn = mk('tbSettings', 'settings', '設定');", 'chrome settings');
    s = s.replace(
      "  const setBtn = mk('tbSettings', 'settings', '設定');",
      "  const phoneBtn = mk('tbPhone', 'phone', '手機版');\n  const setBtn = mk('tbSettings', 'settings', '設定');"
    );
    s = s.replace(
      "  right.appendChild(setBtn);",
      "  right.appendChild(phoneBtn);\n  right.appendChild(setBtn);"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('chrome.js ok');
  } else console.log('chrome.js 已有 tbPhone');
}

/* ── shell.js 綁手機按鈕 ─────────────────────────────────── */
{
  const f = p('ui/shell.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('tbPhone')) {
    must(s, "    var histBtn = document.querySelector('#tbHistory');", 'shell hist bind');
    s = s.replace(
      "    var histBtn = document.querySelector('#tbHistory');",
      "    var phoneBtn = document.querySelector('#tbPhone');\n"
      + "    if (phoneBtn && !phoneBtn.dataset.bound) {\n"
      + "      phoneBtn.dataset.bound = '1';\n"
      + "      phoneBtn.addEventListener('click', function () { window.__moyuPhone && window.__moyuPhone.toggle(); });\n"
      + "    }\n"
      + "    var histBtn = document.querySelector('#tbHistory');"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('shell.js ok');
  } else console.log('shell.js 已綁');
}

/* ── index.html / pack4 ──────────────────────────────────── */
{
  const f = p('ui/index.html');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('src="phone.js"')) {
    must(s, '<script src="shell.js"></script>', 'index shell');
    s = s.replace('<script src="shell.js"></script>', '<script src="shell.js"></script>\n<script src="phone.js"></script>');
    fs.writeFileSync(f, s, 'utf8');
    console.log('index.html ok');
  } else console.log('index.html 已含 phone.js');
}
{
  const f = p('tools/pack4.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("'ui/phone.js'")) {
    must(s, "'ui/shell.js'", 'pack shell');
    s = s.replace("'ui/shell.js'", "'ui/shell.js', 'ui/phone.js'");
    fs.writeFileSync(f, s, 'utf8');
    console.log('pack4.js ok');
  } else console.log('pack4.js 已含 phone.js');
}
