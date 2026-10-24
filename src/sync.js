'use strict';

/* 跨裝置同步：把本機的進度與標記推上去、把別台裝置的拉回來合併
   ─────────────────────────────────────────────────────────────
   後端在 sync/worker.mjs（Cloudflare Worker + D1）。
   本機設定：data/sync.json → { url, token, deviceId, lastSync }
   ══════════════════════════════════════════════════════════════ */

const https = require('https');
const path = require('path');
const crypto = require('crypto');

const store = require('./store');

let cfgPath = '';
let state = { url: '', token: '', deviceId: '', lastSync: 0 };

function init(dataDir) {
  cfgPath = path.join(dataDir, 'sync.json');
  state = Object.assign(state, store.readJson(cfgPath, {}));
  if (!state.deviceId) {
    state.deviceId = 'dev-' + crypto.randomBytes(4).toString('hex');
    save();
  }
}

function save() { if (cfgPath) store.writeJson(cfgPath, state); }

function configured() { return !!(state.url && state.token); }

function configure({ url, token }) {
  if (url !== undefined) state.url = String(url).replace(/\/+$/, '');
  // 空的 token 不要覆蓋掉已存的（面板忘記填金鑰就按儲存時會把同步弄死）。
  // 要清除請明確傳 token: null。
  if (token === null) state.token = '';
  else if (token !== undefined && String(token).trim()) state.token = String(token).trim();
  save();
  return { url: state.url, hasToken: !!state.token, deviceId: state.deviceId };
}

function call(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({
      host: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: {
        Authorization: 'Bearer ' + state.token,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': data.length } : {}),
      },
    }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const t = Buffer.concat(c).toString('utf8');
        let j = null;
        try { j = JSON.parse(t); } catch {}
        if (res.statusCode === 401) return reject(new Error('同步金鑰不對（401）'));
        if (res.statusCode >= 400) return reject(new Error(`同步失敗 HTTP ${res.statusCode}`));
        resolve(j);
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('同步逾時')));
    if (data) req.write(data);
    req.end();
  });
}

/** 推本機 → 伺服器 */
async function push(dataDir) {
  if (!configured()) throw new Error('還沒設定同步（url / token）');
  const progress = store.readJson(path.join(dataDir, 'progress.json'), { books: {} });
  const allMarks = store.readJson(path.join(dataDir, 'marks.json'), {});

  const prog = Object.entries(progress.books || {}).map(([bookId, v]) => ({
    book_id: bookId,
    chapter_id: v.chapterId || '',
    chapter_no: v.chapterNo || '',
    title: v.title || '',
    updated_at: Number(v.updated) || Date.now(),
  }));

  const marks = [];
  const deletedMarks = [];
  for (const [bookId, list] of Object.entries(allMarks)) {
    for (const m of list || []) {
      if (m.deleted) { deletedMarks.push(m.id); continue; }
      marks.push({ ...m, book_id: bookId, updated_at: m.at || Date.now() });
    }
  }

  const r = await call('POST', state.url + '/push', {
    device: state.deviceId, progress: prog, marks, deletedMarks,
  });
  state.lastSync = Date.now();
  save();
  return r;
}

/** 伺服器 → 本機（LWW 合併） */
async function pull(dataDir) {
  if (!configured()) throw new Error('還沒設定同步（url / token）');
  const r = await call('GET', state.url + '/pull?since=0', null);

  // 進度
  const pPath = path.join(dataDir, 'progress.json');
  const local = store.readJson(pPath, { books: {} });
  local.books = local.books || {};
  for (const it of r.progress || []) {
    const cur = local.books[it.book_id];
    if (!cur || (Number(it.updated_at) || 0) > (Number(cur.updated) || 0)) {
      local.books[it.book_id] = {
        chapterId: it.chapter_id, chapterNo: it.chapter_no,
        title: it.title, updated: it.updated_at,
      };
    }
  }
  store.writeJson(pPath, local);

  // 標記
  const mPath = path.join(dataDir, 'marks.json');
  const all = store.readJson(mPath, {});
  let added = 0, removed = 0;
  for (const m of r.marks || []) {
    const list = all[m.book_id] || (all[m.book_id] = []);
    const i = list.findIndex((x) => x.id === m.id);
    if (m.deleted) {
      if (i >= 0) { list.splice(i, 1); removed++; }
      continue;
    }
    const rec = {
      id: m.id, chapterId: m.chapter_id, chapterTitle: m.chapter_title,
      para: m.para, text: m.text, note: m.note, type: m.type, at: m.updated_at,
    };
    if (i >= 0) list[i] = rec; else list.push(rec);
    added++;
  }
  store.writeJson(mPath, all);

  state.lastSync = Date.now();
  save();
  return { ok: true, progress: (r.progress || []).length, marks: added, removed };
}

function status() {
  return {
    configured: configured(),
    url: state.url,
    hasToken: !!state.token,
    deviceId: state.deviceId,
    lastSync: state.lastSync,
  };
}

module.exports = { init, configure, push, pull, status, configured };
