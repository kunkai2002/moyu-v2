// 記住視窗大小 / 位置 / 最大化
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

const f = p('main.js');
let s = fs.readFileSync(f, 'utf8');

/* 1) 讀回上次的視窗狀態，直接套在建立參數上 */
must(s, '/* ── 主視窗 ─────────────────────────────────────────────────── */\nfunction createWindow() {\n  win = new BrowserWindow({\n    width: 1440,\n    height: 900,', 'createWindow');

s = s.replace(
`/* ── 主視窗 ─────────────────────────────────────────────────── */
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,`,
`/* ── 視窗狀態（大小 / 位置 / 最大化）───────────────────────── */
const winStatePath = () => path.join(DATA_DIR, 'window.json');

function readWindowState() {
  const st = store.readJson(winStatePath(), null);
  if (!st || !st.width || !st.height) return null;
  // 上次的位置若已不在任何螢幕內（拔掉外接螢幕），就不要硬套
  try {
    const { screen } = require('electron');
    const areas = screen.getAllDisplays().map((d) => d.workArea);
    const ok = typeof st.x === 'number' && typeof st.y === 'number'
      && areas.some((a) => st.x + 80 > a.x && st.x < a.x + a.width - 80
        && st.y + 40 > a.y && st.y < a.y + a.height - 60);
    if (!ok) { delete st.x; delete st.y; }
  } catch {}
  return st;
}

function saveWindowState(w) {
  if (!w || w.isDestroyed()) return;
  try {
    const b = w.getNormalBounds();     // 最大化時仍然拿到「還原後」的尺寸
    store.writeJson(winStatePath(), {
      width: Math.max(420, Math.round(b.width)),
      height: Math.max(320, Math.round(b.height)),
      x: Math.round(b.x),
      y: Math.round(b.y),
      maximized: w.isMaximized(),
    });
  } catch {}
}

function trackWindowState(w) {
  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(() => saveWindowState(w), 400); };
  w.on('resize', later);
  w.on('move', later);
  w.on('maximize', later);
  w.on('unmaximize', later);
  w.on('close', () => saveWindowState(w));
}

/* ── 主視窗 ─────────────────────────────────────────────────── */
function createWindow() {
  const st = readWindowState() || {};
  win = new BrowserWindow({
    width: st.width || 1440,
    height: st.height || 900,
    ...(typeof st.x === 'number' ? { x: st.x, y: st.y } : {}),
`);

/* 2) 建立後接上追蹤，並還原最大化 */
must(s, '  win.setMenuBarVisibility(false);\n  win.loadFile(', 'after create');
s = s.replace(
  '  win.setMenuBarVisibility(false);\n  win.loadFile(',
  '  win.setMenuBarVisibility(false);\n  trackWindowState(win);\n'
  + '  if (st.maximized) { try { win.maximize(); } catch {} }\n'
  + '  win.loadFile('
);

fs.writeFileSync(f, s, 'utf8');
console.log('main.js: 視窗狀態記憶已加上');
