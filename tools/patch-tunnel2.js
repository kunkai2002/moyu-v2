// 隧道網址 API + 桌面設定面板顯示 + 打包
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* 1. server.js：/api/tunnel */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes("'/api/tunnel'")) {
  const anchor = "    if (p === '/api/health') {";
  const route = `    if (p === '/api/tunnel') {
      let url = '';
      try { url = fs.readFileSync(path.join(DATA_DIR, 'tunnel-url.txt'), 'utf8').trim(); } catch {}
      const running = (() => {
        try { return fs.existsSync(path.join(DATA_DIR, 'tunnel-url.txt')); } catch { return false; }
      })();
      return json(res, 200, { ok: true, url, running });
    }

${anchor}`;
  if (s.includes(anchor)) { fs.writeFileSync(sp, s.replace(anchor, route), 'utf8'); console.log('+ /api/tunnel'); }
  else console.log('! 錨點沒中');
}

/* 2. bridge */
const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('tunnel:')) {
  const a1 = '    update: {';
  if (b.includes(a1)) {
    b = b.replace(a1, "    tunnel: () => api('/api/tunnel'),\n" + a1);
    fs.writeFileSync(bp, b, 'utf8');
    console.log('+ bridge.tunnel');
  }
}

/* 3. 桌面設定面板：公開網址列 */
const wp = path.join(ROOT, 'ui', 'wiring13.js');
if (!fs.existsSync(wp)) {
  fs.writeFileSync(wp, `/* 公開網址（Cloudflare Tunnel）：顯示 + 複製 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const body = $('#panel .panel-body');
  if (!B?.tunnel || !body) return;

  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = '<span>公開網址</span><span class="muted" id="tnUrl">未啟動</span>';
  body.appendChild(row);

  const row2 = document.createElement('div');
  row2.className = 'row';
  row2.innerHTML = '<span></span><button class="btn" id="tnCopy">複製手機網址</button>';
  body.appendChild(row2);

  let current = '';

  async function refresh() {
    const el = $('#tnUrl');
    try {
      const r = await B.tunnel();
      if (r.url) {
        current = r.url;
        el.textContent = r.url.replace(/^https:\\/\\//, '').slice(0, 34) + '…';
        el.style.color = 'var(--ok)';
      } else {
        current = '';
        el.textContent = '未啟動（雙擊 隧道.cmd）';
        el.style.color = '';
      }
    } catch {
      el.textContent = '讀不到';
    }
  }

  $('#tnCopy')?.addEventListener('click', async () => {
    if (!current) { alert('隧道還沒啟動，請先雙擊 隧道.cmd'); return; }
    try { await navigator.clipboard.writeText(current); } catch {}
    $('#tnCopy').textContent = '已複製';
    setTimeout(() => { $('#tnCopy').textContent = '複製手機網址'; }, 1500);
  });

  // 打開設定面板時更新
  new MutationObserver(() => { if (!$('#panel')?.hidden) refresh(); })
    .observe($('#panel'), { attributes: true, attributeFilter: ['hidden'] });
  refresh();
  setInterval(refresh, 30000);
})();
`, 'utf8');
  console.log('+ ui/wiring13.js');
}

/* 4. index.html + pack4 */
const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring13.js')) {
  h = h.replace('<script src="wiring12.js"></script>',
    '<script src="wiring12.js"></script>\n<script src="wiring13.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring13');
}
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring13')) {
  p = p.replace("'ui/wiring12.js',", "'ui/wiring12.js', 'ui/wiring13.js',");
  console.log('+ pack4 加入 wiring13');
}
if (!p.includes('隧道.cmd')) {
  p = p.replace("'更新.cmd',", "'更新.cmd', '隧道.cmd', '開機自動啟動.cmd', 'tools/tunnel-daemon.ps1', 'tools/tunnel-launch.vbs',");
  console.log('+ pack4 加入隧道相關檔');
}
fs.writeFileSync(pp, p, 'utf8');
