// /api/version（讀 .git，不用呼叫 git）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (s.includes("'/api/version'")) { console.log('= 已存在'); process.exit(0); }

const anchor = "    if (p === '/api/health') {";
const route = `    if (p === '/api/version') {
      let sha = 'unknown', branch = 'main';
      try {
        const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
        if (head.startsWith('ref:')) {
          branch = head.slice(5).trim().split('/').pop();
          const refFile = path.join(ROOT, '.git', 'refs', 'heads', branch);
          if (fs.existsSync(refFile)) sha = fs.readFileSync(refFile, 'utf8').trim().slice(0, 7);
          else {
            const packed = fs.readFileSync(path.join(ROOT, '.git', 'packed-refs'), 'utf8');
            const line = packed.split('\\n').find((l) => l.endsWith('refs/heads/' + branch));
            if (line) sha = line.split(' ')[0].slice(0, 7);
          }
        } else sha = head.slice(0, 7);
      } catch {}
      return json(res, 200, { ok: true, sha, branch, dataDir: DATA_DIR });
    }

${anchor}`;

if (!s.includes(anchor)) { console.log('! 錨點沒中'); process.exit(1); }
fs.writeFileSync(sp, s.replace(anchor, route), 'utf8');
console.log('+ /api/version');
