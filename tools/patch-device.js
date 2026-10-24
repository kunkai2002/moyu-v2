// 修「APP 網關失效 → 每章都只有預覽」：Electron 端從沒初始化匿名裝置
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── src/appapi.js ────────────────────────────────────────── */
{
  const f = p('src/appapi.js');
  let s = fs.readFileSync(f, 'utf8');

  // 1) 預設裝置：模組載入就有，不管有沒有呼叫 loadDevice
  must(s, "function setDevice(d) { device = d; }", 'setDevice');
  s = s.replace(
    "function setDevice(d) { device = d; }",
    `function setDevice(d) { device = d; }

/* 任何入口（伺服器 / Electron / 測試）都能先宣告資料目錄；
   沒宣告也不會壞，會用內建的匿名裝置。 */
function useDataDir(dir) {
  if (!dir) return device;
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  loadDevice(dir);
  saveDevice(dir, device);
  return device;
}

function ensureDevice() {
  if (!device) loadDevice(process.cwd());
  return device;
}`
  );

  // 2) buildQuery 前先確保有裝置
  must(s, 'function buildQuery(extra, versionCode = \'70132\') {', 'buildQuery');
  s = s.replace(
    "function buildQuery(extra, versionCode = '70132') {",
    "function buildQuery(extra, versionCode = '70132') {\n  ensureDevice();"
  );

  // 3) registerKey / ensureKey 也確保
  must(s, 'async function registerKey() {', 'registerKey');
  s = s.replace('async function registerKey() {', 'async function registerKey() {\n  ensureDevice();');

  // 4) 匯出
  must(s, 'module.exports = {', 'exports');
  s = s.replace('module.exports = {', 'module.exports = {\n  useDataDir, ensureDevice,');

  fs.writeFileSync(f, s, 'utf8');
  console.log('src/appapi.js ok');
}

/* ── main.js：開機就初始化匿名裝置 ────────────────────────── */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  must(s, "const bookstore = require('./src/shelf');", 'shelf require');
  s = s.replace(
    "const bookstore = require('./src/shelf');",
    "const bookstore = require('./src/shelf');\nconst appapi = require('./src/appapi');"
  );
  must(s, "    fanqie.setCharsetPath(path.join(__dirname, 'src', 'charset.json'));", 'charset init');
  s = s.replace(
    "    fanqie.setCharsetPath(path.join(__dirname, 'src', 'charset.json'));",
    "    fanqie.setCharsetPath(path.join(__dirname, 'src', 'charset.json'));\n"
    + "    // 匿名裝置（跟帳號無關）：沒有它 APP 網關拿不到完整正文，只能退回網頁預覽\n"
    + "    appapi.useDataDir(DATA_DIR);"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('main.js ok');
}
