// 讓測試可以「隱藏視窗」跑：加 --hidden 參數，視窗不現身但照樣能驅動
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);

/* main.js：--hidden 時不顯示視窗 */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('HIDDEN_MODE')) {
    // 1) 常數
    s = s.replace(
      "let settings = { ...DEFAULT_SETTINGS };",
      "// 測試用：--hidden 時視窗不現身（照樣能用偵錯埠驅動、能截圖）\n"
      + "const HIDDEN_MODE = process.argv.includes('--hidden');\n\n"
      + "let settings = { ...DEFAULT_SETTINGS };"
    );
    // 2) reveal 直接跳過
    s = s.replace(
      "  const reveal = () => {\n    if (revealed || !win || win.isDestroyed()) return;",
      "  const reveal = () => {\n    if (HIDDEN_MODE) { revealed = true; return; }\n    if (revealed || !win || win.isDestroyed()) return;"
    );
    // 3) 保險計時器也不要掀窗（reveal 已經會 early return，這裡不用改）
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js 支援 --hidden');
  } else console.log('main.js 已有 HIDDEN_MODE');
}

/* 所有 E2E 腳本：預設帶 --hidden */
{
  const scripts = ['tools/e2e-electron.js', 'tools/e2e-persist.js', 'tools/e2e-flow.js', 'tools/e2e-shelf.js', 'tools/e2e-buttons.js'];
  for (const rel of scripts) {
    const f = p(rel);
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, 'utf8');
    if (s.includes("'--hidden'")) { console.log(rel + ' 已有 --hidden'); continue; }
    // 找 spawn 的第二個參數陣列，插入 '--hidden'
    s = s.replace(
      /--data-dir=\$\{PROBE\}`,\s*`--remote-debugging-port=\$\{PORT\}`/g,
      "--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'"
    );
    fs.writeFileSync(f, s, 'utf8');
    const okNow = s.includes("'--hidden'");
    console.log(rel + (okNow ? ' 已加 --hidden' : ' ⚠️ 沒找到 spawn 參數'));
  }
}
