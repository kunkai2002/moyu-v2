// ① Electron 補上 marks / sync IPC（沒有這些，標記與雲端同步在桌面版是死的）
// ② 章節連讀 + 章間細線 ③ 段落右鍵／小圓球「記住進度」
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(p(f), s, 'utf8');
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── main.js：marks + sync IPC ────────────────────────────── */
{
  const f = 'main.js';
  let s = rd(f);

  must(s, "const appapi = require('./src/appapi');", 'appapi require');
  s = s.replace("const appapi = require('./src/appapi');", "const appapi = require('./src/appapi');\nconst syncer = require('./src/sync');");

  must(s, "    appapi.useDataDir(DATA_DIR);", 'appapi init');
  s = s.replace("    appapi.useDataDir(DATA_DIR);", "    appapi.useDataDir(DATA_DIR);\n    syncer.init(DATA_DIR);");

  must(s, "  ipcMain.handle('progress:get', () =>", 'progress get');
  s = s.replace(
    "  ipcMain.handle('progress:get', () =>",
    `  /* 標記：跟伺服器版同一份 marks.json */
  const marksPath = () => path.join(DATA_DIR, 'marks.json');

  ipcMain.handle('marks:list', (_e, bookId) => {
    const all = store.readJson(marksPath(), {});
    return bookId ? (all[bookId] || []) : all;
  });

  ipcMain.handle('marks:save', (_e, m) => {
    if (!m || !m.bookId) return { ok: false, error: '缺少 bookId' };
    const all = store.readJson(marksPath(), {});
    const list = all[m.bookId] || [];
    const id = m.id || (m.chapterId + '-' + m.para + '-' + m.type);
    const i = list.findIndex((x) => x.id === id);
    const rec = { ...m, id, at: Date.now() };
    if (i >= 0) list[i] = rec; else list.push(rec);
    all[m.bookId] = list;
    store.writeJson(marksPath(), all);
    return { ok: true, id };
  });

  ipcMain.handle('marks:remove', (_e, { bookId, id }) => {
    const all = store.readJson(marksPath(), {});
    all[bookId] = (all[bookId] || []).filter((x) => x.id !== id);
    store.writeJson(marksPath(), all);
    return { ok: true };
  });

  /* 雲端同步（Cloudflare Worker） */
  ipcMain.handle('sync:status', () => syncer.status());
  ipcMain.handle('sync:config', (_e, cfg) => {
    try { syncer.configure(cfg || {}); return { ok: true, ...syncer.status() }; }
    catch (e) { return { ok: false, error: e.message, ...syncer.status() }; }
  });
  ipcMain.handle('sync:push', async () => {
    try { const r = await syncer.push(DATA_DIR); return { ok: true, ...r, status: syncer.status() }; }
    catch (e) { return { ok: false, error: e.message, status: syncer.status() }; }
  });
  ipcMain.handle('sync:pull', async () => {
    try { const r = await syncer.pull(DATA_DIR); return { ok: true, ...r, status: syncer.status() }; }
    catch (e) { return { ok: false, error: e.message, status: syncer.status() }; }
  });

  ipcMain.handle('progress:get', () =>`
  );
  wr(f, s);
  console.log('main.js ok');
}

/* ── preload.js ───────────────────────────────────────────── */
{
  const f = 'ui/preload.js';
  let s = rd(f);
  must(s, "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),", 'preload copy');
  if (!s.includes('marks:')) {
    s = s.replace(
      "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),",
      "  marks: {\n"
      + "    list: (bookId) => ipcRenderer.invoke('marks:list', bookId),\n"
      + "    save: (m) => ipcRenderer.invoke('marks:save', m),\n"
      + "    remove: (payload) => ipcRenderer.invoke('marks:remove', payload),\n"
      + "  },\n"
      + "  sync: {\n"
      + "    status: () => ipcRenderer.invoke('sync:status'),\n"
      + "    config: (cfg) => ipcRenderer.invoke('sync:config', cfg),\n"
      + "    push: () => ipcRenderer.invoke('sync:push'),\n"
      + "    pull: () => ipcRenderer.invoke('sync:pull'),\n"
      + "  },\n"
      + "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),"
    );
    wr(f, s);
    console.log('preload.js ok');
  } else console.log('preload.js 已有 marks');
}
