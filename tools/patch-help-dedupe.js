// 指令表去重：只留 wiring8.js 那一份，wiring.js 的重複表刪掉；並補 /settings
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');

/* wiring8.js：加入 /settings，並把 /login 說明改成掃碼 */
{
  const f = 'ui/wiring8.js';
  let s = rd(f);
  if (!s.includes("['/settings'")) {
    s = s.replace(
      "    ['/login', '手機掃碼登入'],",
      "    ['/login', '手機掃碼登入（QR）'],\n    ['/settings', '設定面板：主題、字級、行距、速度、登入'],"
    );
  }
  wr(f, s);
  console.log('wiring8.js ok');
}

/* wiring.js：刪掉重複的 HELP 定義與渲染（wiring8 會覆蓋，等於死碼） */
{
  const f = 'ui/wiring.js';
  let lines = rd(f).split(/\r?\n/);
  const eol = rd(f).includes('\r\n') ? '\r\n' : '\n';
  const start = lines.findIndex((l) => l.includes('/* ── 指令表 ─'));
  if (start < 0) { console.error('❌ 找不到 wiring.js 指令表註解'); process.exit(1); }
  // 到檔尾的 })(); 為止（指令表是該 IIFE 最後一段）
  const stopLine = lines.findIndex((l, i) => i > start && l.trim().startsWith('})();'));
  if (stopLine < 0) { console.error('❌ 找不到 IIFE 結尾'); process.exit(1); }
  lines.splice(start, stopLine - start);   // 保留 })(); 本身
  wr(f, lines.join(eol));
  console.log('wiring.js: 重複指令表已刪除');
}
