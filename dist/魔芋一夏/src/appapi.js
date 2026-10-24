'use strict';

/* 番茄 APP 網關（reading.snssdk.com/reading）
   ─────────────────────────────────────────────────────────────
   走匿名裝置、不帶任何帳號 cookie。
   取得完整章節正文（不受網頁版 SVIP 預覽限制）與段評。

   出於安全考量：
   · 從不帶使用者 cookie
   · 全局限速（預設每 350ms 最多一個請求）
   ══════════════════════════════════════════════════════════════ */

const https = require('https');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');

const { signRequest, aesCbcDecrypt, md5, DEFAULT_CONFIG } = require('./sign');

const BASE = 'https://reading.snssdk.com/reading';
const ROOT = 'https://reading.snssdk.com';
const UA = 'com.dragon.read';
const SHARED_KEY = Buffer.from([172, 37, 198, 125, 221, 143, 56, 193, 179, 122, 35, 72, 130, 142, 34, 46]);

/* ── 匿名裝置 ───────────────────────────────────────────────
   一個隨機但固定的本機裝置身分。它跟你的番茄帳號沒有任何關係。 */
let device = null;

function loadDevice(dir) {
  const f = path.join(dir, 'device.json');
  try {
    if (fs.existsSync(f)) { device = JSON.parse(fs.readFileSync(f, 'utf8')); }
  } catch {}
  if (!device) {
    device = {
      device_id: '2187355326004404',
      install_id: '2187355326270644',
      device_type: 'P30',
      device_brand: 'realme',
    };
  }
  return device;
}

function saveDevice(dir, d) {
  try { fs.writeFileSync(path.join(dir, 'device.json'), JSON.stringify(d, null, 1)); } catch {}
}

function setDevice(d) { device = d; }

/* ── 限速 ──────────────────────────────────────────────────── */
const MIN_INTERVAL = 350;
let lastCall = 0;

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/* ── 查詢參數 ───────────────────────────────────────────────── */
function buildQuery(extra, versionCode = '70132') {
  const base = {
    iid: device.install_id,
    device_id: device.device_id,
    ac: 'wifi',
    channel: '43536163a',
    aid: '1967',
    app_name: 'novelapp',
    version_code: versionCode,
    version_name: '7.0.1.32',
    device_platform: 'android',
    os: 'android',
    ssmix: 'a',
    os_version: '10',
    device_type: device.device_type || 'P30',
    device_brand: device.device_brand || 'realme',
    update_version_code: '70132',
    manifest_version_code: '70132',
    pv_player: '70132',
    ...extra,
  };
  return new URLSearchParams(base).toString();
}

/* ── HTTP ───────────────────────────────────────────────────── */
function httpRequest(url, opts) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('網關逾時')));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function appGet(pathname, query) {
  await throttle();
  const url = `${BASE}${pathname}?${buildQuery(query)}`;
  const headers = {
    ...signRequest(url),
    'User-Agent': UA,
    Accept: 'application/json',
  };
  const res = await httpRequest(url, { method: 'GET', headers });
  const text = res.body.toString('utf8');
  if (!text.trim()) {
    const e = new Error('網關回空（裝置可能被作廢）');
    e.empty = true;
    throw e;
  }
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error(`網關回非 JSON：${text.slice(0, 120)}`);
  }
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(`網關錯誤 code=${json.code} ${json.message || ''}`);
  }
  return json;
}

async function appPost(pathname, bodyBuf, query, versionCode) {
  await throttle();
  const url = `${BASE}${pathname}?${buildQuery(query, versionCode)}`;
  const headers = {
    ...signRequest(url, bodyBuf),
    'User-Agent': UA,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Encoding': 'gzip',
  };
  const res = await httpRequest(url, { method: 'POST', headers, body: bodyBuf });
  const text = res.body.toString('utf8');
  if (!text.trim()) throw new Error('密鑰註冊回空');
  return JSON.parse(text);
}

/* 書評 / 段評接口掛在網關根路徑，不在 /reading 底下 */
async function appRootPost(pathname, bodyObj) {
  await throttle();
  const url = `${ROOT}${pathname}?${buildQuery({})}`;
  const body = Buffer.from(JSON.stringify(bodyObj), 'utf8');
  const headers = {
    ...signRequest(url, body),
    'User-Agent': UA,
    'Content-Type': 'application/json; charset=utf-8',
  };
  const res = await httpRequest(url, { method: 'POST', headers, body });
  const text = res.body.toString('utf8');
  if (!text.trim()) {
    const e = new Error('評論接口回空');
    e.empty = true;
    throw e;
  }
  return JSON.parse(text);
}

/* ── 密鑰註冊 ───────────────────────────────────────────────── */
let keyInfo = { key: null, keyver: 0 };

async function registerKey() {
  // device_id → 16 bytes 大端 → 反轉，用固定密鑰 AES-CBC 加密
  const idBytes = Buffer.alloc(16);
  let id = BigInt(device.device_id);
  for (let i = 15; i >= 0; i--) { idBytes[i] = Number(id & 0xffn); id >>= 8n; }
  idBytes.reverse();

  const iv = require('crypto').randomBytes(16);
  const c = require('crypto').createCipheriv('aes-128-cbc', SHARED_KEY, iv);
  const enc = Buffer.concat([c.update(idBytes), c.final()]);
  const content = Buffer.concat([iv, enc]);

  const plainBody = JSON.stringify({ content: content.toString('base64') });
  const gz = zlib.gzipSync(Buffer.from(plainBody, 'utf8'));

  const j = await appPost('/crypt/registerkey', gz, {}, '6.3.9.32');
  const ek = j?.data?.key;
  if (!ek) throw new Error(`密鑰註冊沒有回 key：${JSON.stringify(j).slice(0, 160)}`);

  const buf = Buffer.from(ek, 'base64');
  const key = aesCbcDecrypt(SHARED_KEY, buf.subarray(0, 16), buf.subarray(16));
  keyInfo = { key, keyver: j.data.keyver };
  return keyInfo;
}

async function ensureKey(expectedVersion) {
  if (keyInfo.key && (expectedVersion === undefined || keyInfo.keyver === expectedVersion)) return keyInfo;
  return registerKey();
}

/* ── 章節正文 ───────────────────────────────────────────────── */
function decryptContent(b64, key, compressStatus) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 16);
  const data = buf.subarray(16);
  let plain = aesCbcDecrypt(key, iv, data);
  if (compressStatus === 1) plain = zlib.gunzipSync(plain);
  return plain.toString('utf8');
}

function extractParagraphs(text) {
  // 可能回 HTML / xhtml / JSON
  let raw = text;
  if (raw.trim().startsWith('{')) {
    try {
      const j = JSON.parse(raw);
      raw = j.content || j.text || raw;
    } catch {}
  }
  if (/<p[\s>]/i.test(raw)) {
    return [...raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
      .map((s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim())
      .filter(Boolean);
  }
  return raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

async function getChapter(itemId, retry = 0) {
  if (retry > 3) throw new Error('取正文重試次數過多');
  if (!keyInfo.key) await registerKey();

  const j = await appGet('/reader/full/v', { item_id: itemId, req_type: '1' });
  const d = j?.data;
  if (!d || !d.content) throw new Error('網關沒有回內容');

  if (d.content === 'Invalid' || (d.key_version !== undefined && Number(d.key_version) !== keyInfo.keyver)) {
    await registerKey();
    return getChapter(itemId, retry + 1);
  }

  const text = decryptContent(d.content, keyInfo.key, d.compress_status);
  return {
    title: d.title || '',
    paragraphs: extractParagraphs(text),
    raw: text,
    keyver: keyInfo.keyver,
  };
}

module.exports = {
  loadDevice, saveDevice, setDevice, registerKey, getChapter, appGet, appRootPost,
  get keyInfo() { return keyInfo; },
};
