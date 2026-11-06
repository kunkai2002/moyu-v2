// 修掉工具列素材裡被吃掉的引號，並把它插進章節渲染流程
//   node tools/patch-toolrows2.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

const fixes = [
  ['  ["Grep", ""scope" src/", "3 matches"],', "  [\"Grep\", '\"scope\" src/', \"3 matches\"],"],
  ['  ["Grep", ""month" src/lib/", "1 match"],', "  [\"Grep\", '\"month\" src/lib/', \"1 match\"],"],
  ['  ["Search", ""轉折" src/", "2 matches"],', "  [\"Search\", '\"轉折\" src/', \"2 matches\"],"],
];
for (const [a, b] of fixes) {
  if (s.includes(a)) { s = s.split(a).join(b); n++; console.log('· 修引號：' + a.trim().slice(0, 40)); }
}

const oldInsert = `      if (idx < paras.length - 1 && (base + idx + 1) % perDiff === 0) {
        container.appendChild(fakeDiff(base + idx + 1));
      }`;
const newInsert = `      if (idx < paras.length - 1 && (base + idx + 1) % perDiff === 0) {
        container.appendChild(fakeDiff(base + idx + 1));
      }
      // 工具呼叫列：每 5 段一列（跟 diff 的 9 段錯開），一塊最多 3 列
      if (idx < paras.length - 1 && (base + idx + 1) % 5 === 0 && (base + idx + 1) % perDiff !== 0
        && container.querySelectorAll('.toolrow').length < 3) {
        container.appendChild(toolRow(base + idx + 1));
      }`;
if (s.includes(oldInsert)) { s = s.split(oldInsert).join(newInsert); n++; console.log('· 插入工具列到章節渲染'); }
else console.log('! 插入點仍找不到');

fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
