// 收尾修正（audit 51 項最後 3 項）
//   ① rail 模式：`.side-top` 直接 display:none（原本 height:0 還留著可點範圍 → 按鈕被判定「被蓋住」）
//      並隱藏 `.side .rz`（收成 56 軌時拖寬手柄會蓋住品牌列那顆 toggle）
//   ② 使用者氣泡底色改用 bg-layer-2（#2c2c2e），跟 DSH 一致（原本用 layer-1 #232324）
//   ③ audit：輸入卡片圓角改成真值 28（原 16 是舊的近似值）；主題矩陣的色碼比對做 hex 正規化（#fff == #ffffff）
//   node tools/patch-audit-fix.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let n = 0;

/* ① + ② ui/theme.css */
{
  const p = path.join(ROOT, 'ui', 'theme.css');
  let s = fs.readFileSync(p, 'utf8');
  const a = '[data-shell="dsh"] .app.side-rail .side-top{height:0;margin:0;padding:0;overflow:hidden}';
  const b = '[data-shell="dsh"] .app.side-rail .side-top{display:none}\n[data-shell="dsh"] .app.side-rail .side .rz{display:none}';
  if (s.includes(a)) { s = s.split(a).join(b); n++; console.log('· rail：side-top 改 display:none、藏 rz'); }
  else if (s.includes('side-rail .side-top{display:none}')) console.log('· rail 已修過');

  const c = 'background:var(--dsh-color-bg-elev);border:0;border-radius:var(--dsh-radius-xl);';
  const d = 'background:var(--dsh-color-sel);border:0;border-radius:var(--dsh-radius-xl);';
  if (s.includes(c)) { s = s.split(c).join(d); n++; console.log('· 氣泡底色改 bg-layer-2（#2c2c2e）'); }
  else if (s.includes('background:var(--dsh-color-sel);border:0;border-radius:var(--dsh-radius-xl);')) console.log('· 氣泡底色已修過');
  fs.writeFileSync(p, s, 'utf8');
}

/* ③ tools/audit-chat-ui.js */
{
  const p = path.join(ROOT, 'tools', 'audit-chat-ui.js');
  let s = fs.readFileSync(p, 'utf8');

  const oldBox = "&& dshLook.boxRadius === '16px'";
  const newBox = "&& dshLook.boxRadius === '28px'   /* 真值 --dsw-radius-panel（docs/DSH-真值.json），不是舊的 16 */";
  if (s.includes(oldBox)) { s = s.split(oldBox).join(newBox); n++; console.log('· audit：輸入卡片圓角 16 → 28（真值）'); }
  s = s.split('輸入框 16px').join('輸入框 28px');

  if (!s.includes('const norm = (c) =>')) {
    const anchor = '        const out = [];';
    const inject = [
      '        /* 色碼正規化：#fff 與 #ffffff 是同一個顏色（DSH 真值給的是 3 碼） */',
      '        const norm = (c) => {',
      '          const h = String(c).trim().toLowerCase().replace("#", "");',
      '          return h.length === 3 ? h.split("").map((x) => x + x).join("") : h;',
      '        };',
      anchor,
    ].join('\n');
    if (s.includes(anchor)) { s = s.split(anchor).join(inject); n++; console.log('· audit：主題矩陣加 hex 正規化'); }
  }
  if (s.includes('ok: got === want,')) { s = s.split('ok: got === want,').join('ok: norm(got) === norm(want),'); n++; console.log('· audit：比對改用 norm()'); }
  fs.writeFileSync(p, s, 'utf8');
}

console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
