// 把 main.js / preload.js 接到 Electron 主線：無邊框 + 視窗控制 + 關窗到托盤
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mainPath = path.join(ROOT, 'main.js');
const preloadPath = path.join(ROOT, 'ui', 'preload.js');

let main = fs.readFileSync(mainPath, 'utf8');
let hit = 0;

// 1) 無邊框（自訂標題列）
if (!main.includes('frame: false')) {
  main = main.replace(
    "    backgroundColor: '#1a1915',",
    "    backgroundColor: '#1a1915',\n    frame: false,\n    titleBarStyle: 'hidden',",
  );
  hit++;
}

// 2) 視窗控制 IPC
if (!main.includes("ipcMain.handle('win:min'")) {
  const anchor = "  ipcMain.handle('app:quit', () => { app.isQuitting = true; app.quit(); });";
  const add = `${anchor}

  /* 自訂標題列用的視窗控制 */
  ipcMain.handle('win:min', () => { win?.minimize(); return true; });
  ipcMain.handle('win:max', () => {
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('win:close', () => {
    if (!win) return true;
    if (settings.closeToTray) win.hide(); else { app.isQuitting = true; win.close(); }
    return true;
  });`;
  if (main.includes(anchor)) { main = main.replace(anchor, add); hit++; }
  else console.log('  ! 找不到 app:quit 錨點，跳過視窗控制');
}

fs.writeFileSync(mainPath, main, 'utf8');

// 3) preload 補上 win / comments / qr / shelf.raw
let pre = fs.readFileSync(preloadPath, 'utf8');
if (!pre.includes('win: {')) {
  pre = pre.replace(
    '  onBoss: (cb) => ipcRenderer.on(\'boss\', (_e, on) => cb(on)),',
    `  win: {
    min: () => ipcRenderer.invoke('win:min'),
    max: () => ipcRenderer.invoke('win:max'),
    close: () => ipcRenderer.invoke('win:close'),
  },
  onBoss: (cb) => ipcRenderer.on('boss', (_e, on) => cb(on)),`,
  );
  fs.writeFileSync(preloadPath, pre, 'utf8');
  console.log('  + preload.win');
  hit++;
}

console.log(hit ? `套用 ${hit} 處` : '無需修改');
