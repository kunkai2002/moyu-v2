'use strict';

/* 雲端熱更新
   ─────────────────────────────────────────────────────────────
   Worker 上放著「這個 app 的每一個檔案 + 版本雜湊」（D1: app_files / app_meta）。
   桌面版比對雜湊後只抓不一樣的那幾個檔案：

     1. 檔案直接覆蓋安裝目錄（data\ 永遠不碰）
     2. 只有 ui\*.js / ui\*.css → 視窗 reload，程式不用關、不用重開
     3. main.js / src\ 之類也變了 → 檔案先落地，這次照舊跑，
        下次開啟就是新版（JOJO 的規矩：不准叫他關程式）

   設定沿用同步的 data\sync.json（url / token），版本記在 data\app-version.json。
   ══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');   // 安裝目錄（src 的上一層）
const KEEP_OUT = 'data';                   // 這個目錄底下的東西一個都不准動
const HOT = /^ui\/[^/]+\.(js|css|html)$/;  // 換掉就能靠 reload 生效的檔案

let DATA_DIR = '';
let url = '';
let token = '';
let localVersion = '';

function init(dataDir) {
  DATA_DIR = dataDir;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dataDir, 'sync.json'), 'utf8'));
    url = String(s.url || '').replace(/\/+$/, '');
    token = String(s.token || '');
  } catch {}
  try {
    const v = JSON.parse(fs.readFileSync(versionPath(), 'utf8'));
    localVersion = String(v.version || '');
  } catch {}
}

function versionPath() { return path.join(DATA_DIR, 'app-version.json'); }

function configured() { return !!(url && token); }

function sha1(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }

function request(method, pathAndQuery, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url + pathAndQuery);
    const lib = u.protocol === 'http:' ? http : https;
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = lib.request({
      host: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      method,
      headers: Object.assign(
        { Authorization: 'Bearer ' + token },
        data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {},
      ),
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) {
          return reject(new Error('更新 HTTP ' + res.statusCode + '：' + buf.toString('utf8').slice(0, 160)));
        }
        resolve(buf);
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('更新逾時')));
    if (data) req.write(data);
    req.end();
  });
}

async function getJson(p) {
  const buf = await request('GET', p);
  return JSON.parse(buf.toString('utf8'));
}

/** 原始位元組（伺服器回的就是檔案內容，不要轉字串） */
async function getFile(p) {
  return await request('GET', p);
}

/** 比對雲端與本機：只回「哪幾個檔案不一樣」 */
async function check() {
  if (!configured()) return { ok: false, error: '還沒設定雲端（url / token）' };
  let m;
  try { m = await getJson('/app/manifest'); } catch (e) { return { ok: false, error: e.message }; }
  if (!m || m.ok === false) return { ok: false, error: (m && m.error) || 'manifest 讀不到' };

  const files = Object.keys(m.files || {});
  const changed = [];
  for (const f of files) {
    if (f.split('/')[0] === KEEP_OUT) continue;
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { changed.push(f); continue; }
    let hash = '';
    try { hash = sha1(fs.readFileSync(p)); } catch { continue; }
    if (hash !== m.files[f]) changed.push(f);
  }
  return {
    ok: true,
    local: localVersion,
    remote: String(m.version || ''),
    files: changed,
    upToDate: changed.length === 0,
  };
}

/** 抓下來覆蓋。回傳哪些是熱更新、哪些要下次開啟才生效 */
async function apply(opts) {
  const force = !!(opts && opts.force);
  const c = await check();
  if (!c.ok) return { applied: false, message: c.error };
  if (!c.files.length) return { applied: false, upToDate: true, message: '已是最新版本' };

  const hot = [];
  const cold = [];
  for (const f of c.files) {
    if (f.split('/')[0] === KEEP_OUT) continue;
    const dest = path.join(ROOT, f);
    if (!dest.startsWith(ROOT + path.sep)) continue;   // 不准跳出安裝目錄
    let body;
    try { body = await getFile('/app/file?p=' + encodeURIComponent(f)); }
    catch (e) { return { applied: false, message: f + '：' + e.message }; }
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, body);        // 原始位元組，不經過任何編碼轉換
    } catch (e) {
      return { applied: false, message: f + '：' + e.message };
    }
    (HOT.test(f) ? hot : cold).push(f);
  }

  try {
    fs.writeFileSync(versionPath(), JSON.stringify({
      version: c.remote, appliedAt: Date.now(), files: c.files,
    }, null, 1), 'utf8');
  } catch {}
  localVersion = c.remote;

  return {
    applied: true,
    version: c.remote,
    hot, cold,
    reload: hot.length > 0 && cold.length === 0,
    defer: cold.length > 0,      // 有本體檔案 → 下次開啟生效
    message: cold.length > 0
      ? `已更新 ${c.files.length} 個檔案，重開程式後生效`
      : `已更新 ${c.files.length} 個檔案`,
    force,
  };
}

function status() {
  return { configured: configured(), url, version: localVersion };
}

module.exports = { init, check, apply, status, configured, ROOT };
