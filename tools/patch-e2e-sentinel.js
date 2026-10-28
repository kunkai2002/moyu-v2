// 自檢腳本：哨兵要等（章節載入後才掛），不要一瞬間就判定沒有
const fs = require('fs');
const f = 'tools/e2e-buttons.js';
let s = fs.readFileSync(f, 'utf8');

const old = `  const flow = await page.evaluate(() => ({
    sentinel: !!document.querySelector('.flow-more'),
    index: window.__moyuDebug.state.index,
  }));
  flow.sentinel ? ok('連讀：底部哨兵存在') : bad('連讀：沒有哨兵');`;

const neu = `  let flow = { sentinel: false, index: 0 };
  for (let i = 0; i < 20; i++) {
    flow = await page.evaluate(() => ({
      sentinel: !!document.querySelector('.flow-more'),
      index: window.__moyuDebug.state.index,
    }));
    if (flow.sentinel) break;
    await sleep(400);
  }
  flow.sentinel ? ok('連讀：底部哨兵存在') : bad('連讀：沒有哨兵');`;

if (!s.includes('哨兵要等')) {
  if (!s.includes(old)) { console.error('❌ 錨點失效'); process.exit(1); }
  s = s.replace(old, neu);
  fs.writeFileSync(f, s, 'utf8');
  console.log('e2e-buttons.js 哨兵等待已加入');
} else console.log('已改過');
