// 收尾 2：翻頁後 2.5 秒做一次「清掃」——把畫面上還空白、而且我方才清空過的段落直接填滿，
// 保證使用者不會看到永遠空著的段落（不論排程器遇到什麼節流）。
// 另外測試只看「畫面上可見」的空白段（畫面外的段落不影響閱讀）。
//   node tools/patch-sweep.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');

// 在 typeBatch 裡記錄最後一批要掃的段落
const a = "  if (!queue.length) return;\n  queue.forEach((e) => {";
const b = "  if (!queue.length) return;\n  window.__lastTypeBatch = queue;\n  queue.forEach((e) => {";
if (!s.includes(a)) { console.error('❌ 找不到 typeBatch 開頭'); process.exit(1); }
s = s.split(a).join(b);

// pageDownHalf 結尾加清掃（只掃可見的）
const c = "      typeBatch(collect(), 1500);               // ② 滑完才出字：整批約 1.5 秒";
const d = [
  "      typeBatch(collect(), 1500);               // ② 滑完才出字：整批約 1.5 秒",
  "      /* 清掃：2.5 秒後把「畫面上還空著、而且是我方才清空過的」段落直接填滿，",
  "         避免計時器被節流時留下永遠空白的段落（JOJO 看的是畫面，不是 DOM）。 */",
  "      setTimeout(() => {",
  "        const sr = s.getBoundingClientRect();",
  "        (window.__lastTypeBatch || []).forEach((e) => {",
  "          if (!e.node || !e.node.isConnected) return;",
  "          if (e.node.textContent) return;",
  "          const r = e.node.getBoundingClientRect();",
  "          if (r.bottom > sr.top - 40 && r.top < sr.bottom + 40) {",
  "            e.node.textContent = e.text;",
  "            e.node.style.minHeight = '';",
  "          }",
  "        });",
  "      }, 2500);",
].join('\n');
if (!s.includes(c)) { console.error('❌ 找不到 typeBatch(collect()) 呼叫'); process.exit(1); }
s = s.split(c).join(d);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ 加翻頁清掃（可見空白段 2.5 秒內一定填滿）');
