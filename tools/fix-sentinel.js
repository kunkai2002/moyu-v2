// flow.js：每 900ms 確保哨兵存在（換書/重建 thread 的時序縫隙補起來）
const fs = require('fs');
const f = 'ui/flow.js';
let s = fs.readFileSync(f, 'utf8');

const old = `  setInterval(function () {
    if (lastIndex !== st.index) {
      if (lastIndex >= 0) blocked = false;
      lastIndex = st.index;
      sentinel = null;
      makeSentinel();
      paintSentinel();
    }
  }, 900);`;

const neu = `  setInterval(function () {
    if (lastIndex !== st.index) {
      if (lastIndex >= 0) blocked = false;
      lastIndex = st.index;
      sentinel = null;
    }
    if (!st.book || !st.chapters || !st.chapters.length) return;
    // 換書、重建 thread、首頁切換都可能讓哨兵掉隊，這裡補回來
    makeSentinel();
    paintSentinel();
  }, 900);`;

if (s.includes(old)) {
  s = s.replace(old, neu);
  fs.writeFileSync(f, s, 'utf8');
  console.log('flow.js 哨兵守護已加');
} else console.log('flow.js 錨點不符');
