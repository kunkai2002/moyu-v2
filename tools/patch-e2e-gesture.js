// 讓自檢腳本模擬「使用者滾動」：wheel + scroll，並斷言每輪只接一章
const fs = require('fs');
const f = 'tools/e2e-buttons.js';
let s = fs.readFileSync(f, 'utf8');

const oldBlock = `  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const s = document.querySelector('#stream');
      s.scrollTop = s.scrollHeight;
      s.dispatchEvent(new Event('scroll'));
    });
    await sleep(2200);
  }`;

const newBlock = `  let perRound = [];
  for (let i = 0; i < 3; i++) {
    const before = await page.evaluate(() => window.__moyuDebug.state.index);
    await page.evaluate(() => {
      const s = document.querySelector('#stream');
      s.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true }));
      s.scrollTop = s.scrollHeight;
      s.dispatchEvent(new Event('scroll'));
    });
    await sleep(2600);
    const after = await page.evaluate(() => window.__moyuDebug.state.index);
    perRound.push(after - before);
  }`;

if (!s.includes('perRound')) {
  if (!s.includes(oldBlock)) { console.error('❌ 錨點失效'); process.exit(1); }
  s = s.replace(oldBlock, newBlock);
  s = s.replace(
    "  after.index > flow.index ? ok(`連讀：${flow.index} → ${after.index} 章（細線 ${after.seps}）`) : bad('連讀：沒有自動接章', JSON.stringify(after));",
    "  after.index > flow.index ? ok(`連讀：${flow.index} → ${after.index} 章（細線 ${after.seps}）`) : bad('連讀：沒有自動接章', JSON.stringify(after));\n"
    + "  const runaway = perRound.some((n) => n > 1);\n"
    + "  runaway ? bad('連讀：一輪接了多章（會自己往前衝）', JSON.stringify(perRound)) : ok(`連讀：每輪最多一章 ${JSON.stringify(perRound)}`);"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('e2e-buttons.js 已加入手勢與節流斷言');
} else {
  console.log('已改過');
}
