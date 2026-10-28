// 自檢的「使用者手勢」要模擬對：先捲到底，再發 wheel，再 scroll
const fs = require('fs');

const seq = (v) => [
  "    const s = document.querySelector('#stream');",
  "    s.scrollTop = s.scrollHeight;",
  "    s.dispatchEvent(new Event('scroll'));",
  "    s.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true }));",
  "    s.dispatchEvent(new Event('scroll'));",
].join('\n');

/* e2e-flow.js */
{
  const f = 'tools/e2e-flow.js';
  let s = fs.readFileSync(f, 'utf8');
  const old = `  for (let round = 0; round < 5; round++) {
    await page.evaluate(() => {
      const s = document.querySelector('#stream');
      s.scrollTop = s.scrollHeight;
      s.dispatchEvent(new Event('scroll'));
    });
    await sleep(2600);
  }`;
  const neu = `  for (let round = 0; round < 4; round++) {
    await page.evaluate(() => {
${seq()}
    });
    await sleep(2800);
  }`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    fs.writeFileSync(f, s, 'utf8');
    console.log('e2e-flow: 手勢序列已修');
  } else console.log('e2e-flow: 錨點不同（略過）');
}

/* e2e-buttons.js */
{
  const f = 'tools/e2e-buttons.js';
  let s = fs.readFileSync(f, 'utf8');
  const old = `  for (let i = 0; i < 3; i++) {
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
  const neu = `  for (let i = 0; i < 3; i++) {
    const before = await page.evaluate(() => window.__moyuDebug.state.index);
    await page.evaluate(() => {
${seq()}
    });
    await sleep(2600);
    const after = await page.evaluate(() => window.__moyuDebug.state.index);
    perRound.push(after - before);
  }`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    fs.writeFileSync(f, s, 'utf8');
    console.log('e2e-buttons: 手勢序列已修');
  } else console.log('e2e-buttons: 錨點不同（略過）');
}
