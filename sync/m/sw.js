/* 魔芋一夏 · 手機版離線快取
   規則：
   1. 外殼（html/css/js/圖）→ 先給快取、背景順便更新（stale-while-revalidate）
      → 沒網路也能打開，而且下一次進來就是新版
   2. 讀過的章節 /api/chapter → 有快取直接給，最多留 80 章
   3. 進度 / 書架 / 標記 → 先問網路，失敗才用快取（資料寧可新）
*/
var SHELL = 'moyu-m-shell-v1';
var DATA = 'moyu-m-data-v1';
var MAX_CHAPTERS = 80;

var SHELL_URLS = [
  '/m/', '/m/index.html', '/m/app.css', '/m/app.js',
  '/m/icon.svg', '/m/manifest.webmanifest',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      return Promise.all(SHELL_URLS.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); }),
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== DATA) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); }),
  );
});

function isShell(url) {
  return url.pathname === '/m' || url.pathname.indexOf('/m/') === 0;
}

/* 外殼：先快取，再背景更新 */
function shell(req) {
  return caches.open(SHELL).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () { return null; });
      if (hit) { net.catch(function () {}); return hit; }
      return net.then(function (res) {
        return res || new Response('<!doctype html><meta charset="utf-8"><title>離線</title>'
          + '<body style="font-family:system-ui;background:#1a1915;color:#e8e3d9;padding:32px">'
          + '現在沒有網路，這台裝置也還沒存到東西。</body>',
        { headers: { 'content-type': 'text/html; charset=utf-8' } });
      });
    });
  });
}

/* 章節：有就用（章節內容不會變），沒有的話抓回來存 */
function chapter(req) {
  return caches.open(DATA).then(function (cache) {
    return cache.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          cache.put(req, res.clone()).then(function () { trim(cache); });
        }
        return res;
      }).catch(function () {
        return new Response(JSON.stringify({ ok: false, error: '離線，這一章還沒存下來' }),
          { headers: { 'content-type': 'application/json; charset=utf-8' } });
      });
    });
  });
}

function trim(cache) {
  cache.keys().then(function (keys) {
    var chs = keys.filter(function (k) { return k.url.indexOf('/api/chapter') >= 0; });
    if (chs.length <= MAX_CHAPTERS) return;
    var drop = chs.slice(0, chs.length - MAX_CHAPTERS);
    Promise.all(drop.map(function (k) { return cache.delete(k); }));
  });
}

/* 進度 / 書架 / 標記：先網路，失敗才回快取 */
function fresh(req) {
  return caches.open(DATA).then(function (cache) {
    return fetch(req).then(function (res) {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(function () {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return new Response(JSON.stringify({ ok: false, error: '離線' }),
          { headers: { 'content-type': 'application/json; charset=utf-8' } });
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (isShell(url)) { e.respondWith(shell(req)); return; }
  if (url.pathname.indexOf('/api/chapter') === 0) { e.respondWith(chapter(req)); return; }
  if (url.pathname.indexOf('/api/') === 0) { e.respondWith(fresh(req)); return; }
});
