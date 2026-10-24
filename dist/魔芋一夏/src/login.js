'use strict';

/* 同源 passport 掃碼登入
   ─────────────────────────────────────────────────────────────
   1. GET  /passport/web/get_qrcode/       → 拿到 QR 圖（base64 PNG）+ token + csrf cookie
   2. 使用者用手機「抖音」或「番茄小說」App 掃碼確認
   3. GET  /passport/web/check_qrconnect/  → status 變成 confirmed 時回 sessionid
   ══════════════════════════════════════════════════════════════ */

const https = require('https');
const zlib = require('zlib');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ORIGIN = 'https://fanqienovel.com';
const COMMON = 'aid=2503&app_name=muye_novel&language=zh';
const NEXT = encodeURIComponent('https://fanqienovel.com/');

function req(url, cookie) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': UA,
      Referer: ORIGIN + '/',
      Accept: 'application/json, text/plain, */*',
    };
    if (cookie) headers.Cookie = cookie;
    const r = https.get(url, { headers }, (resp) => {
      const c = [];
      resp.on('data', (d) => c.push(d));
      resp.on('end', () => {
        let b = Buffer.concat(c);
        if ((resp.headers['content-encoding'] || '').includes('gzip')) {
          try { b = zlib.gunzipSync(b); } catch {}
        }
        let json = null;
        try { json = JSON.parse(b.toString('utf8')); } catch {}
        resolve({ status: resp.statusCode, headers: resp.headers, json, text: b.toString('utf8') });
      });
    });
    r.on('error', reject);
    r.setTimeout(20000, () => r.destroy(new Error('passport 逾時')));
  });
}

function cookieFrom(headers) {
  const raw = headers['set-cookie'] || [];
  return raw.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
}

/** 開始一次掃碼，回傳 QR 圖與 token */
async function startQr() {
  const r = await req(`${ORIGIN}/passport/web/get_qrcode/?${COMMON}&next=${NEXT}`);
  const d = r.json?.data || {};
  if (d.error_code !== 0 || !d.qrcode) {
    throw new Error(`產生 QR 失敗：${d.description || r.text.slice(0, 80)}`);
  }
  return {
    token: d.token,
    image: 'data:image/png;base64,' + d.qrcode,
    expire: Number(d.expire_time) || 0,
    cookie: cookieFrom(r.headers),
  };
}

/**
 * 輪詢掃碼結果。
 * status: new（還沒掃） / scanning（已掃待確認） / confirmed（成功） / expired
 */
async function pollQr(token, cookie) {
  const csrf = (cookie.match(/passport_csrf_token=([^;]+)/) || [])[1] || '';
  const url = `${ORIGIN}/passport/web/check_qrconnect/?${COMMON}`
    + `&token=${encodeURIComponent(token)}`
    + `&csrf_token=${encodeURIComponent(csrf)}`
    + `&next=${NEXT}`;
  const r = await req(url, cookie);
  const d = r.json?.data || {};

  const setCookie = cookieFrom(r.headers);
  const merged = [cookie, setCookie].filter(Boolean).join('; ');

  if (d.error_code !== 0) {
    return { status: 'error', message: d.description || '未知錯誤', cookie: merged };
  }

  const status = String(d.status || 'new');
  const done = status === 'confirmed' || status === 'success' || !!d.sessionid;
  return {
    status: done ? 'confirmed' : status,
    cookie: merged,
    // 成功的關鍵 cookie 一定要有 sessionid
    sessionId: (merged.match(/sessionid=([^;]+)/) || [])[1] || '',
  };
}

module.exports = { startQr, pollQr };
