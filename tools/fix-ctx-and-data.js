// 1) 清掉測試污染（先備份）2) 右鍵選單改成貼段落右側，不遮正文
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const APP_DATA = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');

/* ── 1. 備份 + 清理安裝版資料 ── */
const bk = path.join('D:\\kun-workspace\\backup', 'moyu-data-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''));
fs.mkdirSync(bk, { recursive: true });
for (const f of ['progress.json', 'marks.json', 'stats.json', 'last-book.json']) {
  const p = path.join(APP_DATA, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(bk, f));
}
console.log('已備份到', bk);

// 進度：只刪測試書，其他保留
const progPath = path.join(APP_DATA, 'progress.json');
if (fs.existsSync(progPath)) {
  const p = JSON.parse(fs.readFileSync(progPath, 'utf8'));
  const TEST_BOOKS = ['7143038691944959011', '7373660003258862617'];
  let removed = 0;
  for (const id of TEST_BOOKS) {
    if (p.books && p.books[id]) { delete p.books[id]; removed++; }
  }
  const remain = Object.keys(p.books || {});
  p.lastBook = remain[0] || undefined;
  if (!p.lastBook) delete p.lastBook;
  fs.writeFileSync(progPath, JSON.stringify(p, null, 1), 'utf8');
  console.log(`进度：清掉 ${removed} 本测试书，剩 ${remain.length} 本`);
}

// marks：清掉測試書
const marksPath = path.join(APP_DATA, 'marks.json');
if (fs.existsSync(marksPath)) {
  const m = JSON.parse(fs.readFileSync(marksPath, 'utf8'));
  for (const id of ['7143038691944959011', '7373660003258862617']) delete m[id];
  fs.writeFileSync(marksPath, JSON.stringify(m, null, 1), 'utf8');
  console.log('标记：已清除测试数据');
}

// stats：我的測試那筆
const statsPath = path.join(APP_DATA, 'stats.json');
if (fs.existsSync(statsPath)) {
  fs.writeFileSync(statsPath, JSON.stringify({ days: {} }, null, 1), 'utf8');
  console.log('统计：已重置');
}

// last-book：刪掉（避免自動開測試書）
const lbPath = path.join(APP_DATA, 'last-book.json');
if (fs.existsSync(lbPath)) { fs.rmSync(lbPath); console.log('last-book：已刪除'); }

/* ── 2. 右鍵選單：貼段落右側，不遮正文 ── */
const cp = path.join(ROOT, 'ui', 'chrome.js');
let c = fs.readFileSync(cp, 'utf8');

// showCtx 改為接受「避開區域」
c = c.replace(
  `    ctx.style.left = Math.min(x, innerWidth - 190) + 'px';
    ctx.style.top = Math.min(y, innerHeight - 20 - items.length * 32) + 'px';`,
  `    // 避開被右鍵的那一塊：優先放到它右側，右邊不夠就放左側
    const avoid = ctxTarget?.getBoundingClientRect?.();
    const w = 190;
    const h = items.length * 32 + 12;
    if (avoid) {
      let nx = avoid.right + 12;
      if (nx + w > innerWidth - 8) nx = avoid.left - w - 12;
      if (nx < 8) nx = Math.min(x, innerWidth - w - 8);
      let ny = Math.min(avoid.top, innerHeight - h - 8);
      if (ny < 44) ny = 44;
      ctx.style.left = nx + 'px';
      ctx.style.top = ny + 'px';
    } else {
      ctx.style.left = Math.min(x, innerWidth - w) + 'px';
      ctx.style.top = Math.min(y, innerHeight - h) + 'px';
    }
    ctx.style.maxHeight = h + 'px';`,
);

// 讓三種情境都設定 ctxTarget
c = c.replace(
  `    if (ch) {
      e.preventDefault();
      const idx = [...document.querySelectorAll('#tree .ch')].indexOf(ch);`,
  `    if (ch) {
      e.preventDefault();
      ctxTarget = ch;
      const idx = [...document.querySelectorAll('#tree .ch')].indexOf(ch);`,
);
c = c.replace(
  `    if (p) {
      e.preventDefault();
      const text = (p.textContent || '').slice(0, 200);`,
  `    if (p) {
      e.preventDefault();
      ctxTarget = p;
      const text = (p.textContent || '').slice(0, 200);`,
);
c = c.replace(
  `    if (card) {
      e.preventDefault();`,
  `    if (card) {
      e.preventDefault();
      ctxTarget = card;`,
);
c = c.replace('  let ctxTarget = null;', '  let ctxTarget = null;');

fs.writeFileSync(cp, c, 'utf8');
console.log('+ 右鍵選單改為避開正文');
