/* 瀏覽器模式的外殼橋接：把 window.moyu 用 HTTP 補起來
   （Electron 版由 preload.js 提供，不會載入這裡） */
(function () {
  if (window.moyu) { window.moyuMode = 'electron'; return; }
  if (!/^https?:$/.test(location.protocol)) { window.moyuMode = 'file'; return; }

  const api = async (path, opts) => {
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  };
  const post = (path, body) =>
    api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  window.moyuMode = 'http';
  window.moyu = {
    mode: 'http',
    config: {
      get: () => api('/api/config'),
      set: (patch) => post('/api/config', patch),
    },
    login: async () => ({ ok: false, needQr: true }),
    qr: {
      start: () => post('/api/qr/start', {}),
      poll: (token) => api(`/api/qr/poll?token=${encodeURIComponent(token)}`),
    },
    boss: {
      toggle: () => post('/api/boss', {}),
      set: (on) => post('/api/boss', { on }),
    },
    shelf: {
      list: async () => (await api('/api/shelf')).books || [],
      raw: () => api('/api/shelf'),
      cached: async () => [],
    },
    openBook: (input) => post('/api/open', { input }),
    search: (bookId, q) => api(`/api/search?book=${encodeURIComponent(bookId)}&q=${encodeURIComponent(q)}`),
    lastBook: () => api('/api/last-book'),
    exportBook: (bookId, limit) =>
      api(`/api/export?book=${encodeURIComponent(bookId)}&limit=${limit || 50}`),
    comments: (bookId, sort) =>
      api(`/api/comments?book=${encodeURIComponent(bookId)}&sort=${sort || 1}`),
    loadChapter: (bookId, chapterId) =>
      api(`/api/chapter?book=${encodeURIComponent(bookId)}&id=${encodeURIComponent(chapterId)}`),
    progress: {
      get: () => api('/api/progress'),
      set: (p) => post('/api/progress', p),
    },
    cookie: {
      set: (value) => post('/api/cookie', { value }),
      get: () => api('/api/cookie'),
    },
    version: () => api('/api/version'),
    prefetch: {
      start: (bookId) => post('/api/prefetch', { bookId }),
      status: () => api('/api/prefetch/status'),
      stop: () => post('/api/prefetch/stop', {}),
    },
    update: { check: () => api('/api/update'), apply: () => post('/api/update/apply', {}) },
    sync: {
      status: () => api('/api/sync/status'),
      config: (c) => post('/api/sync/config', c),
      push: () => post('/api/sync/push', {}),
      pull: () => post('/api/sync/pull', {}),
    },
    stats: {
      get: () => api('/api/stats'),
      add: (d) => post('/api/stats', d),
    },
    marks: {
      list: (bookId) => api('/api/marks?book=' + encodeURIComponent(bookId)),
      save: (m) => post('/api/marks', m),
      remove: (bookId, id) => post('/api/marks', { action: 'remove', bookId, id }),
    },
    copy: async (text) => {
      const prefixed = String(text).split('\n').map((l) => '// ' + l).join('\n');
      try { await navigator.clipboard.writeText(prefixed); return true; } catch { return false; }
    },
    boss: async (on) => { document.body.classList.toggle('bossing', !!on); return !!on; },
    hide: async () => { document.body.classList.remove('bossing'); },
    quit: async () => { window.close(); },
    onBoss: (cb) => {
      document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); cb(!document.body.classList.contains('bossing')); }
      });
    },
  };
})();
