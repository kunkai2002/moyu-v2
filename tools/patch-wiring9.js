// 註冊 wiring9 + bridge.sync + selfcheck 打包完整性檢查
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* bridge.sync */
const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('sync:')) {
  const a1 = '    stats: {';
  const add = [
    '    sync: {',
    "      status: () => api('/api/sync/status'),",
    "      config: (c) => post('/api/sync/config', c),",
    "      push: () => post('/api/sync/push', {}),",
    "      pull: () => post('/api/sync/pull', {}),",
    '    },',
    a1,
  ].join('\n');
  if (b.includes(a1)) { fs.writeFileSync(bp, b.replace(a1, add), 'utf8'); console.log('+ bridge.sync'); }
  else console.log('! bridge 錨點沒中');
} else console.log('= bridge.sync 已存在');

/* index.html */
const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring9.js')) {
  h = h.replace('<script src="wiring8.js"></script>',
    '<script src="wiring8.js"></script>\n<script src="wiring9.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring9');
}

/* pack4 */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring9')) {
  p = p.replace("'ui/wiring8.js',", "'ui/wiring8.js', 'ui/wiring9.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring9');
}

/* selfcheck：新增 [8] 打包完整性 */
const cp = path.join(ROOT, 'tools', 'selfcheck.js');
let c = fs.readFileSync(cp, 'utf8');
if (!c.includes('[8] 打包完整性')) {
  const anchor = "  srv.kill();\n  await sleep(300);";
  const add = `  /* ── 7. 打包完整性：server 的 require 在 dist 裡都要有 ── */
  console.log('\\n[7] 打包完整性');
  {
    const dist = path.join(ROOT, 'dist', '魔芋一夏');
    const srvSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const reqs = [...srvSrc.matchAll(/require\\('\\.\\/([^']+)'\\)/g)].map((m) => m[1]);
    const missing = reqs.filter((r) => !fs.existsSync(path.join(dist, r)) && !fs.existsSync(path.join(dist, r + '.js')));
    if (missing.length) bad('dist 缺少: ' + missing.join(', '));
    else ok('server.js 的 ' + reqs.length + ' 個 require 在 dist 都在');
    const uiSrc = fs.readFileSync(path.join(ROOT, 'ui', 'index.html'), 'utf8');
    const scripts = [...uiSrc.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    const uiMiss = scripts.filter((f) => !fs.existsSync(path.join(dist, 'ui', f)));
    if (uiMiss.length) bad('dist/ui 缺少: ' + uiMiss.join(', '));
    else ok('index.html 的 ' + scripts.length + ' 個 script 在 dist 都在');
  }

${anchor}`;
  if (c.includes(anchor)) { fs.writeFileSync(cp, c.replace(anchor, add), 'utf8'); console.log('+ selfcheck [7] 打包完整性'); }
  else console.log('! selfcheck 錨點沒中');
}
