// 追加「工具呼叫列」（⏺ Read(...) / ⏺ Grep(...) + ⎿ 結果），讓畫面上除了
// 「已完成思考」與紅綠 diff 之外，還有更多像編碼工具的痕跡（JOJO 2026-11-06 要求）。
//   node tools/patch-toolrows.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

/* ① 素材池 + 產生器：插在 fakeDiff 之前 */
const anchor = '/* 段落之間的一塊假 diff：看起來像剛改完檔案，其實是偽裝 */';
const block = [
  '/* ── 工具呼叫列：⏺ Read(src/…) ＋ ⎿ 結果 ──────────────────────────',
  '   這是「AI 編碼工具」最明顯的痕跡，比 diff 更常出現：讀檔、搜尋、跑測試、',
  '   改一行、跑 lint。JOJO 2026-11-06：「我這邊還是只能看到兩個迷惑人的」，',
  '   所以每一章都要看得到幾列，而不是只有收起來的思考塊。 */',
  'const TOOL_VERBS = [',
  '  ["Read", "src/gateway/report.ts", "18 lines"],',
  '  ["Read", "src/lib/query.ts", "42 lines"],',
  '  ["Grep", "\"scope\" src/", "3 matches"],',
  '  ["Grep", "\"month\" src/lib/", "1 match"],',
  '  ["Edit", "src/lib/query.ts", "+2 −1"],',
  '  ["Edit", "src/gateway/report.ts", "+6 −2"],',
  '  ["Run", "node tools/audit-chat-ui.js", "51 passed"],',
  '  ["Run", "node tools/layout-gate.js", "21 passed"],',
  '  ["Test", "src/lib/query.test.ts", "12 passed"],',
  '  ["Typecheck", "tsc --noEmit", "0 errors"],',
  '  ["Lint", "eslint src/", "0 warnings"],',
  '  ["Build", "node scripts/build.mjs", "ok 1.2s"],',
  '  ["Search", "\"轉折\" src/", "2 matches"],',
  '  ["Format", "prettier --write src/", "3 files"],',
  '];',
  '',
  'function toolRow(n) {',
  '  const [verb, arg, res] = TOOL_VERBS[Math.abs(n) % TOOL_VERBS.length];',
  '  const box = el("div", "toolrow");',
  '  box.dataset.tool = verb;',
  '  box.innerHTML = \'<span class="tr-bu">⏺</span>\'',
  '    + \'<span class="tr-v">\' + escapeHtml(verb) + \'</span>\'',
  '    + \'<span class="tr-a">(\' + escapeHtml(arg) + \')</span>\';',
  '  const out = el("div", "toolrow-res");',
  '  out.innerHTML = \'<span class="tr-bar">⎿</span><span>\' + escapeHtml(res) + \'</span>\';',
  '  box.appendChild(out);',
  '  return box;',
  '}',
  '',
  '',
].join('\n');
if (!s.includes('function toolRow(n)')) {
  if (!s.includes(anchor)) { console.error('❌ 找不到 fakeDiff 錨點'); process.exit(1); }
  s = s.replace(anchor, block + anchor);
  n++;
  console.log('· 加入 TOOL_VERBS 與 toolRow()');
}

/* ② 插進章節渲染流程：每 5 段一列（跟 diff 的 9 段錯開） */
const old = `      // 假 diff 用「全章第幾段」對齊節奏，跨小塊才不會斷掉
      if (idx < paras.length - 1 && (base + idx + 1) % perDiff === 0) {
        container.appendChild(fakeDiff(base + idx + 1));
      }`;
const neu = `      // 假 diff 用「全章第幾段」對齊節奏，跨小塊才不會斷掉
      if (idx < paras.length - 1 && (base + idx + 1) % perDiff === 0) {
        container.appendChild(fakeDiff(base + idx + 1));
      }
      // 工具呼叫列：每 5 段一列（跟 diff 的節奏錯開），一章最多 3 列
      if (idx < paras.length - 1 && (base + idx + 1) % 5 === 0 && (base + idx + 1) % perDiff !== 0
        && container.querySelectorAll('.toolrow').length < 3) {
        container.appendChild(toolRow(base + idx + 1));
      }`;
if (s.includes(old)) { s = s.replace(old, neu); n++; console.log('· 章節渲染時插入工具列（每 5 段、最多 3 列）'); }
else console.log('! 找不到插入點（可能已改過）');

fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
