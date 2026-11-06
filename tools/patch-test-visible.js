// test-reveal 只看「畫面上可見的空白段」——畫面外不影響閱讀（JOJO 看的是畫面）
//   node tools/patch-test-visible.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-reveal.js');
let s = fs.readFileSync(p, 'utf8');

// 取樣時多帶「可見空白段數」
const a = "      ps.forEach((p) => { m[p.dataset.pi] = p.textContent.length; });\n      return { t: ms, scrollTop: Math.round(document.querySelector('#stream').scrollTop), m };";
const b = "      ps.forEach((p) => { m[p.dataset.pi] = p.textContent.length; });\n      const st = document.querySelector('#stream');\n      const sr = st.getBoundingClientRect();\n      const visibleBlank = ps.filter((p) => { const r = p.getBoundingClientRect(); return p.textContent.length === 0 && r.bottom > sr.top && r.top < sr.bottom; }).length;\n      return { t: ms, scrollTop: Math.round(st.scrollTop), m, visibleBlank };";
if (!s.includes(a)) { console.error('❌ 找不到取樣區塊'); process.exit(1); }
s = s.split(a).join(b);

// 完成訊號改成「可見空白段歸零」
s = s.replace(
  "    const blanks = Object.keys(s.m).filter((pi) => maxLen[pi] > 10 && s.m[pi] === 0).length;",
  "    const blanks = s.visibleBlank;"
);
s = s.replace(
  "      const left = Object.keys(s.m).filter((pi) => maxLen[pi] > 10 && s.m[pi] === 0).length;",
  "      const left = s.visibleBlank;"
);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ test-reveal 改看「可見空白段」');
