// 加視窗命令：讀取/設定目前視窗狀態（也給自檢用）
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* main.js */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("win:state")) {
    must(s, "  ipcMain.handle('win:min', () => { win?.minimize(); return true; });", 'win:min');
    s = s.replace(
      "  ipcMain.handle('win:min', () => { win?.minimize(); return true; });",
      `  ipcMain.handle('win:state', () => {
    if (!win || win.isDestroyed()) return null;
    const b = win.getNormalBounds();
    return { ...b, maximized: win.isMaximized(), fullScreen: win.isFullScreen() };
  });

  ipcMain.handle('win:set-state', (_e, st) => {
    if (!win || win.isDestroyed() || !st) return false;
    try {
      if (st.maximized === true) { win.maximize(); }
      else {
        if (st.maximized === false && win.isMaximized()) win.unmaximize();
        if (st.width && st.height) {
          win.setBounds({
            width: Math.max(420, Math.round(st.width)),
            height: Math.max(320, Math.round(st.height)),
            ...(typeof st.x === 'number' ? { x: Math.round(st.x) } : {}),
            ...(typeof st.y === 'number' ? { y: Math.round(st.y) } : {}),
          });
        }
      }
      saveWindowState(win);
      return true;
    } catch { return false; }
  });

  ipcMain.handle('win:min', () => { win?.minimize(); return true; });`
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js: win:state / win:set-state');
  } else console.log('main.js 已有 win:state');
}

/* preload */
{
  const f = p('ui/preload.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('setState')) {
    must(s, "  win: {", 'preload win');
    s = s.replace(
      "  win: {",
      "  win: {\n    state: () => ipcRenderer.invoke('win:state'),\n    setState: (st) => ipcRenderer.invoke('win:set-state', st),"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('preload.js: win.state / win.setState');
  } else console.log('preload.js 已有');
}

/* e2e-window.js：改用應用內命令 */
{
  const f = p('tools/e2e-window.js');
  let s = fs.readFileSync(f, 'utf8');
  const oldHelper = `async function winInfo(page) {
  const session = await page.target().createCDPSession();
  const { windowId } = await session.send('Browser.getWindowForTarget');
  const { bounds } = await session.send('Browser.getWindowBounds', { windowId });
  await session.detach().catch(() => {});
  return { windowId, bounds };
}

async function setBounds(page, bounds) {
  const session = await page.target().createCDPSession();
  const { windowId } = await session.send('Browser.getWindowForTarget');
  await session.send('Browser.setWindowBounds', { windowId, bounds });
  await session.detach().catch(() => {});
}`;
  const newHelper = `async function winInfo(page) {
  const st = await page.evaluate(async () => await window.moyu.win.state());
  return { bounds: st || {} };
}

async function setBounds(page, bounds) {
  await page.evaluate(async (b) => { await window.moyu.win.setState(b); }, bounds);
}`;
  if (s.includes(oldHelper)) {
    s = s.replace(oldHelper, newHelper);
    s = s.replace("await setBounds(app.page, { windowState: 'maximized' });", "await setBounds(app.page, { maximized: true });");
    s = s.replace("(max2.bounds.windowState === 'maximized' || max1.bounds.windowState === 'maximized')",
      "(max2.bounds.maximized === true || max1.bounds.maximized === true)");
    s = s.replace("`最大化：重開後仍是 ${max2.bounds.windowState}`", "`最大化：重開後仍是 ${max2.bounds.maximized}`");
    fs.writeFileSync(f, s, 'utf8');
    console.log('e2e-window.js: 改用應用內命令');
  } else console.log('e2e-window.js 錨點不同');
}
