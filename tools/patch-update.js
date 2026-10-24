// 更新檢查：伺服器 /api/update + UI 列 + 打包註冊
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 1. wiring12.js ── */
const wiring12 = `/* 更新檢查：比對 GitHub 最新 commit */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const body = $('#panel .panel-body');
  if (!B?.update || !body) return;

  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = '<span>版本</span><span class="muted" id="updText">—</span>';
  body.appendChild(row);

  const r2 = document.createElement('div');
  r2.className = 'row';
  r2.innerHTML = '<span></span><button class="btn" id="updCheck">檢查更新</button>';
  body.appendChild(r2);

  const txt = row.querySelector('#updText');

  async function check() {
    txt.textContent = '檢查中…';
    try {
      const r = await B.update.check();
      if (!r.ok) { txt.textContent = '檢查失敗：' + (r.error || ''); return; }
      txt.textContent = r.upToDate
        ? '已是最新（' + r.local + '）'
        : '有新版本：' + r.remote + ' → 本機 ' + r.local;
      txt.style.color = r.upToDate ? 'var(--ok)' : 'var(--acc)';
    } catch (e) {
      txt.textContent = '檢查失敗：' + e.message;
    }
  }

  r2.querySelector('#updCheck').addEventListener('click', check);
  check();
})();
`;
fs.writeFileSync(path.join(ROOT, 'ui', 'wiring12.js'), wiring12, 'utf8');
console.log('+ ui/wiring12.js');

/* ── 2. server.js ── */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes("'/api/update'")) {
  const anchor = "    if (p === '/api/health') {";
  const route = `    if (p === '/api/update') {
      const now = Date.now();
      if (!updateCache.at || now - updateCache.at > 600000) {
        let sha = 'unknown';
        try {
          const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
          if (head.startsWith('ref:')) {
            const br = head.slice(5).trim().split('/').pop();
            const rf = path.join(ROOT, '.git', 'refs', 'heads', br);
            if (fs.existsSync(rf)) sha = fs.readFileSync(rf, 'utf8').trim().slice(0, 7);
          } else sha = head.slice(0, 7);
        } catch {}
        updateCache.local = sha;
        try {
          const body = await new Promise((resolve, reject) => {
            const req2 = https.get('https://api.github.com/repos/kunkai2002/moyu-v2/commits?per_page=1', {
              headers: { 'User-Agent': 'moyu-update' },
            }, (r) => {
              let d = '';
              r.on('data', (c) => { d += c; });
              r.on('end', () => resolve(d));
            });
            req2.on('error', reject);
            req2.setTimeout(8000, () => req2.destroy(new Error('timeout')));
          });
          const j = JSON.parse(body);
          updateCache.remote = j?.[0]?.sha ? j[0].sha.slice(0, 7) : '';
        } catch (e) { updateCache.remote = ''; updateCache.err = e.message; }
        updateCache.at = now;
      }
      const upToDate = !!updateCache.remote && updateCache.remote === updateCache.local;
      return json(res, 200, {
        ok: !!updateCache.remote,
        local: updateCache.local,
        remote: updateCache.remote,
        upToDate,
        error: updateCache.err || '',
      });
    }

${anchor}`;
  if (s.includes(anchor)) {
    s = s.replace(anchor, route);
    // 需要 https 與快取
    if (!s.includes("const https = require('https');")) {
      s = s.replace("const http = require('http');", "const http = require('http');\nconst https = require('https');");
    }
    if (!s.includes('const updateCache')) {
      s = s.replace('const commentCache = new Map();', 'const commentCache = new Map();\nconst updateCache = { at: 0, local: "", remote: "", err: "" };');
    }
    fs.writeFileSync(sp, s, 'utf8');
    console.log('+ /api/update');
  } else console.log('! server 錨點沒中');
}

/* ── 3. bridge ── */
const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('update:')) {
  const a1 = '    sync: {';
  if (b.includes(a1)) {
    b = b.replace(a1, "    update: { check: () => api('/api/update') },\n" + a1);
    fs.writeFileSync(bp, b, 'utf8');
    console.log('+ bridge.update');
  }
}

/* ── 4. index.html / pack4 ── */
const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring12.js')) {
  h = h.replace('<script src="wiring11.js"></script>',
    '<script src="wiring11.js"></script>\n<script src="wiring12.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring12');
}
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring12')) {
  p = p.replace("'ui/wiring11.js',", "'ui/wiring11.js', 'ui/wiring12.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring12');
}
