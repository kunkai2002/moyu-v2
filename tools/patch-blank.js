// 修白屏：等漆面完成才顯示視窗 + 空白自癒 + 保險計時器
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);

const f = p('main.js');
let s = fs.readFileSync(f, 'utf8');
const before = s;

const oldBlock = `  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });
`;

const newBlock = `  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  /* 顯示時機：等到畫面真的漆完再現身。
     太早 show() 在部分顯示卡上會留下全白視窗，得從托盤再點一次才重繪。 */
  let revealed = false;
  let reloaded = false;
  const reveal = () => {
    if (revealed || !win || win.isDestroyed()) return;
    revealed = true;
    win.show();
    win.focus();
    try { win.moveTop(); } catch {}
    try { win.webContents.invalidate(); } catch {}
  };

  win.once('ready-to-show', () => setTimeout(reveal, 140));
  win.webContents.once('did-finish-load', () => {
    setTimeout(reveal, 200);
    // 自癒：載入後若內容是空的，無視快取重載一次
    setTimeout(async () => {
      if (!win || win.isDestroyed()) return;
      try {
        const len = await win.webContents.executeJavaScript('document.body.innerText.trim().length');
        if (len < 24 && !reloaded) { reloaded = true; win.webContents.reloadIgnoringCache(); }
      } catch {}
    }, 3200);
  });
  // 保險：無論如何 7 秒內一定現身
  setTimeout(reveal, 7000);
`;

if (!s.includes(oldBlock)) {
  console.error('找不到要替換的區塊');
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);
if (s !== before) { fs.writeFileSync(f, s, 'utf8'); console.log('main.js patched'); }
