const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'm', 'm.js');
let s = fs.readFileSync(p, 'utf8');

// 未登入 → 用 'login' 空狀態，並把原始錯誤放進說明
s = s.replace(
  "if (!r.ok) { emptyState(state, grid, r.error || '還沒登入'); return; }",
  `if (!r.ok) {
        const offline = /連線|fetch|network|timeout/i.test(r.error || '');
        emptyState(state, grid, offline ? 'offline' : 'login');
        return;
      }`,
);

fs.writeFileSync(p, s, 'utf8');
console.log('+ 空狀態依錯誤類型切換（login / offline）');
