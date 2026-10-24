// 手機版：路由 /m、LAN 綁定、MIME、打包
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 1. server.js ── */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');

// 1a. 目錄索引 + /m 轉址
if (!s.includes("'/m/index.html'")) {
  s = s.replace(
    "  let p = urlPath === '/' ? '/index.html' : urlPath;",
    "  let p = urlPath === '/' ? '/index.html' : urlPath;\n  if (p === '/m' || p === '/m/') p = '/m/index.html';\n  if (p.endsWith('/')) p += 'index.html';",
  );
  console.log('+ /m 路由');
}

// 1b. MIME
if (!s.includes("'.webmanifest'")) {
  s = s.replace("'.woff2': 'font/woff2',", "'.woff2': 'font/woff2',\n  '.webmanifest': 'application/manifest+json; charset=utf-8',");
  console.log('+ webmanifest MIME');
}

// 1c. 綁 0.0.0.0（手機連得到）
if (!s.includes('--host')) {
  s = s.replace(
    "const PORT = Number(arg('port', 47821));",
    "const PORT = Number(arg('port', 47821));\nconst HOST = arg('host', '0.0.0.0');",
  );
  s = s.replace(
    "server.listen(PORT, '127.0.0.1', () => {",
    "server.listen(PORT, HOST, () => {",
  );
  // 印出區網網址
  s = s.replace(
    "  console.log(`  資料目錄 ${DATA_DIR}`);",
    `  console.log(\`  資料目錄 \${DATA_DIR}\`);
  try {
    const nets = require('os').networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const n of list || []) {
        if (n.family === 'IPv4' && !n.internal) {
          console.log(\`  手機版 http://\${n.address}:\${PORT}/m/\`);
        }
      }
    }
  } catch {}`,
  );
  console.log('+ LAN 綁定 0.0.0.0（手機可連）');
}

fs.writeFileSync(sp, s, 'utf8');

/* ── 2. pack4 加入手機版 ── */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes("ui/m/index.html")) {
  p = p.replace("'ui/index.html',", "'ui/index.html', 'ui/m/index.html', 'ui/m/m.css', 'ui/m/m.js', 'ui/m/manifest.webmanifest', 'ui/m/sw.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 ui/m/*');
}
