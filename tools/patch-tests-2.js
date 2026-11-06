// 兩個測試修正：
// ① test-typing：改用頁內 20ms 輪詢取樣（MutationObserver 會把同一幀的多次寫入合併，抓不到曲線）
// ② audit：DSH 三尺寸迴圈裡，每個尺寸量測前都先收掉抽屜遮罩（避免「被蓋住」誤判）
//   node tools/patch-tests-2.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let n = 0;

/* ① test-typing */
{
  const p = path.join(ROOT, 'tools', 'test-typing.js');
  let s = fs.readFileSync(p, 'utf8');
  const oldStart = s.indexOf('  /* 逐字效果只有 ~200ms');
  const oldEnd = s.indexOf('  // 新章在畫面下方（看不到）。往下捲進新內容，這時才應該「快速出字」。');
  if (oldStart > 0 && oldEnd > oldStart) {
    const repl = [
      '  /* 逐字效果只有 ~200ms，MutationObserver 會把同一幀的多次寫入合併成一次，',
      '     所以改成頁內每 20ms 自己取樣一次長度，捲動後再讀整條曲線。 */',
      '  await page.evaluate(() => {',
      '    window.__typeSamples = [];',
      '    clearInterval(window.__typeTimer);',
      '    window.__typeTimer = setInterval(() => {',
      '      const m = {};',
      '      document.querySelectorAll("#stream .p").forEach((p) => { m[p.dataset.pi] = p.textContent.length; });',
      '      window.__typeSamples.push({ t: Date.now(), m });',
      '    }, 20);',
      '  });',
      '',
    ].join('\n');
    s = s.slice(0, oldStart) + repl + s.slice(oldEnd);
    n++; console.log('· test-typing：改成頁內 20ms 輪詢');
  }
  // 斷言改用 __typeSamples
  const oldAssertStart = s.indexOf('  // ① 捲進來的那幾段要「逐字長」');
  const oldAssertEnd = s.indexOf('  // ② 不是整章打字');
  if (oldAssertStart > 0 && oldAssertEnd > oldAssertStart) {
    const repl = [
      '  // ① 捲進來的那幾段要「逐字長」：同一段在 600ms 內出現 ≥3 個遞增長度',
      '  const rows = await page.evaluate(() => { clearInterval(window.__typeTimer); return window.__typeSamples || []; });',
      '  const per = {};',
      '  for (const r of rows) for (const pi of Object.keys(r.m)) (per[pi] = per[pi] || []).push({ t: r.t, len: r.m[pi] });',
      '  let stepped = 0; let sample = null;',
      '  for (const pi of Object.keys(per)) {',
      '    const arr = per[pi];',
      '    const lens = [...new Set(arr.map((x) => x.len))].filter((x) => x > 0);',
      '    const span = arr.length ? arr[arr.length - 1].t - arr[0].t : 0;',
      '    if (lens.length >= 3 && span <= 900) { stepped++; sample = sample || { pi, lens: lens.slice(0, 6), span }; }',
      '  }',
      '  stepped > 0',
      '    ? ok("捲進來的那段是逐字長出來的", `${stepped} 段有多階成長（例：pi ${sample.pi} ${sample.lens.join("→")}，${sample.span}ms）`)',
      '    : bad("捲進來那段沒有逐字效果", JSON.stringify(Object.keys(per).slice(0, 5).map((k) => [k, per[k].map((x) => x.len)])));',
      '',
    ].join('\n');
    s = s.slice(0, oldAssertStart) + repl + s.slice(oldAssertEnd);
    n++; console.log('· test-typing：斷言改用輪詢曲線');
  }
  fs.writeFileSync(p, s, 'utf8');
}

/* ② audit：每個尺寸前先收遮罩 */
{
  const p = path.join(ROOT, 'tools', 'audit-chat-ui.js');
  let s = fs.readFileSync(p, 'utf8');
  const old = `  for (const { w, h } of [{ w: 1440, h: 900 }, { w: 1920, h: 1080 }, { w: 820, h: 620 }]) {
    await page.evaluate((st) => window.moyu?.win?.setState?.(st), { width: w, height: h });
    await sleep(650);`;
  const neu = `  for (const { w, h } of [{ w: 1440, h: 900 }, { w: 1920, h: 1080 }, { w: 820, h: 620 }]) {
    await page.evaluate((st) => window.moyu?.win?.setState?.(st), { width: w, height: h });
    await sleep(650);
    // 每個尺寸量測前都把 <1024 的右欄抽屜收掉（遮罩會讓所有按鈕被判定成「被蓋住」）
    await page.evaluate(() => {
      document.querySelector('.app')?.classList.remove('toc-open');
      document.body.classList.remove('bossing');
    });
    await sleep(120);`;
  if (s.includes(old)) { s = s.split(old).join(neu); n++; console.log('· audit：每個尺寸前收抽屜'); }
  else console.log('  ! audit 找不到迴圈');
  fs.writeFileSync(p, s, 'utf8');
}

console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
