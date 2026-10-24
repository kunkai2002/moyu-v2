// 接上 /api/sync/*
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (s.includes("'/api/sync/status'")) { console.log('= 已存在'); process.exit(0); }

// require
s = s.replace(
  "const { getShelf } = require('./src/shelf');",
  "const { getShelf } = require('./src/shelf');\nconst sync = require('./src/sync');",
);

// 啟動時初始化
s = s.replace(
  'appapi.loadDevice(DATA_DIR);',
  'appapi.loadDevice(DATA_DIR);\nsync.init(DATA_DIR);',
);

// 路由
const anchor = "    if (p === '/api/health') {";
const route = `    if (p === '/api/sync/status') {
      return json(res, 200, { ok: true, ...sync.status() });
    }

    if (p === '/api/sync/config' && req.method === 'POST') {
      const b = await readBody(req);
      return json(res, 200, { ok: true, ...sync.configure(b) });
    }

    if (p === '/api/sync/push') {
      try { return json(res, 200, { ok: true, ...(await sync.push(DATA_DIR)) }); }
      catch (e) { return json(res, 200, { ok: false, error: e.message }); }
    }

    if (p === '/api/sync/pull') {
      try { return json(res, 200, { ok: true, ...(await sync.pull(DATA_DIR)) }); }
      catch (e) { return json(res, 200, { ok: false, error: e.message }); }
    }

${anchor}`;

if (!s.includes(anchor)) { console.log('! 錨點沒中'); process.exit(1); }
s = s.replace(anchor, route);
fs.writeFileSync(sp, s, 'utf8');
console.log('+ /api/sync/*');
