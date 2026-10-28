// 端到端驗證「雲端熱更新」：真的發佈一個版本 → 桌面版自己比對、自己抓、
// 自己覆蓋檔案，全程不關程式。測完會把雲端恢復成現在的正式版。
//
// 流程：
//   ① 發佈現在的原始碼（讓雲端 == 安裝目錄）
//   ② 開一個乾淨的實例 → 檢查要回「已是最新」
//   ③ 發佈一個被動過的 ui/polish.js（多一行註解）→ 檢查要抓到那一個檔案
//   ④ apply() → 檔案真的被換掉、且判定為「熱更新（reload 就生效）」
//   ⑤ 再發佈原始碼、再 apply() → 檔案恢復原狀
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { collect, publish, stamp, shortSha } = require('./publish-app');

const APP = process.argv[2] || path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const REAL = path.join(APP, 'data');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-update');
const PORT = 9344;
const MARK = '\n/* __hot_update_probe__ */\n';

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = path.join(APP, 'ui', 'polish.js');

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const f of ['cookie.txt', 'sync.json', 'prefs.json', 'settings.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });

  /* ① 雲端先跟本機對齊 */
  const real = collect();
  const v1 = `${stamp()}-${shortSha()}`;
  await publish(real, v1);
  console.log('① 已發佈目前版本', v1);

  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'update.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log] });

  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { console.error('❌ 連不上偵錯埠'); process.exit(2); }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    page = pages.find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  if (!page) { console.error('❌ 找不到 app 頁面'); browser.disconnect(); process.exit(2); }
  await sleep(1500);

  const hasUpdateApi = await page.evaluate(() => !!(window.moyu && window.moyu.update));
  hasUpdateApi ? ok('preload 有 update 介面') : bad('preload 沒有 update 介面（舊版沒換到？）');

  /* ② 對齊後要說「已是最新」 */
  const c1 = await page.evaluate(() => window.moyu.update.check()).catch((e) => ({ ok: false, error: e.message }));
  c1 && c1.ok && c1.upToDate
    ? ok(`檢查：已是最新（雲端版本 ${c1.remote}）`)
    : bad('檢查：對齊後還說要更新', JSON.stringify(c1));

  try {
    /* ③ 發佈一個改過的 polish.js（body 是 base64，要先解回來再改） */
    const crypto = require('crypto');
    const patched = real.map((f) => {
      if (f.path !== 'ui/polish.js') return f;
      const raw = Buffer.concat([Buffer.from(f.body, 'base64'), Buffer.from(MARK, 'utf8')]);
      return { path: f.path, body: raw.toString('base64'), hash: crypto.createHash('sha1').update(raw).digest('hex') };
    });
    const v2 = `${stamp()}-${shortSha()}`;
    await publish(patched, v2);
    console.log('③ 已發佈測試版本', v2);

    const c2 = await page.evaluate(() => window.moyu.update.check());
    const hit = c2.ok && (c2.files || []).includes('ui/polish.js');
    hit ? ok(`檢查：抓到 ${c2.files.length} 個要更新的檔案（ui/polish.js）`) : bad('檢查：沒抓到改動的檔案', JSON.stringify(c2));

    /* ④ 套用 */
    const ap = await page.evaluate(() => window.moyu.update.apply());
    const onDisk = fs.readFileSync(target, 'utf8');
    ap && ap.applied ? ok(`套用：更新 ${(ap.hot || []).length + (ap.cold || []).length} 個檔案`) : bad('套用失敗', JSON.stringify(ap));
    onDisk.includes('__hot_update_probe__') ? ok('套用：檔案真的被換掉了') : bad('套用：檔案沒變');
    ap && ap.reload === true ? ok('套用：判定為熱更新（reload 就生效）') : bad('套用：判斷成需要重開', JSON.stringify(ap && { reload: ap.reload, cold: ap.cold }));

    const verFile = path.join(PROBE, 'app-version.json');
    fs.existsSync(verFile) && JSON.parse(fs.readFileSync(verFile, 'utf8')).version === v2
      ? ok('套用：版本記在 data\\app-version.json')
      : bad('套用：版本沒記錄');
  } finally {
    /* ⑤ 恢復正式版 */
    const v3 = `${stamp()}-${shortSha()}`;
    await publish(real, v3);
    const back = await page.evaluate(() => window.moyu.update.apply()).catch(() => null);
    await sleep(400);
    const restored = fs.readFileSync(target, 'utf8');
    !restored.includes('__hot_update_probe__')
      ? ok('恢復：安裝目錄已回到正式版')
      : bad('恢復失敗：安裝目錄還留著測試內容', JSON.stringify(back));
    console.log('⑤ 已恢復正式版', v3);
  }

  const after = await page.evaluate(() => window.moyu.update.check());
  after && after.ok && after.upToDate ? ok('恢復後：又回到「已是最新」') : bad('恢復後還是要更新', JSON.stringify(after));

  console.log('\n===== 雲端熱更新 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(500);
  process.exit(fails === 0 ? 0 : 1);
})();
