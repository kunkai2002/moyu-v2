// 補 stats IPC（wiring7 會呼叫 B.stats.add，桌面版缺這個會拋錯）+ 連讀時保住閱讀位置
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── main.js：stats ───────────────────────────────────────── */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  must(s, "  ipcMain.handle('sync:status', () => syncer.status());", 'sync status');
  s = s.replace(
    "  ipcMain.handle('sync:status', () => syncer.status());",
    `/* 閱讀統計：跟伺服器版同一份 stats.json */
  ipcMain.handle('stats:get', () => {
    const db = store.readJson(path.join(DATA_DIR, 'stats.json'), { days: {} });
    const keys = Object.keys(db.days).sort();
    const today = db.days[new Date().toISOString().slice(0, 10)] || { chars: 0, chapters: 0, seconds: 0 };
    const last7 = keys.slice(-7).map((k) => ({ date: k, ...db.days[k] }));
    const total = keys.reduce((a, k) => ({
      chars: a.chars + db.days[k].chars,
      chapters: a.chapters + db.days[k].chapters,
      seconds: a.seconds + db.days[k].seconds,
    }), { chars: 0, chapters: 0, seconds: 0 });
    return { ok: true, today, last7, total, days: keys.length };
  });

  ipcMain.handle('stats:add', (_e, r) => {
    const fpath = path.join(DATA_DIR, 'stats.json');
    const db = store.readJson(fpath, { days: {} });
    const d = new Date().toISOString().slice(0, 10);
    const day = db.days[d] || { chars: 0, chapters: 0, seconds: 0 };
    day.chars += Number(r && r.chars) || 0;
    day.chapters += 1;
    day.seconds += Number(r && r.seconds) || 0;
    db.days[d] = day;
    store.writeJson(fpath, db);
    return { ok: true, today: day };
  });

  ipcMain.handle('sync:status', () => syncer.status());`
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('main.js ok');
}

/* ── preload.js ───────────────────────────────────────────── */
{
  const f = p('ui/preload.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('stats:')) {
    must(s, "  sync: {", 'preload sync');
    s = s.replace(
      "  sync: {",
      "  stats: {\n"
      + "    get: () => ipcRenderer.invoke('stats:get'),\n"
      + "    add: (r) => ipcRenderer.invoke('stats:add', r),\n"
      + "  },\n"
      + "  sync: {"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('preload.js ok');
  } else console.log('preload.js 已有 stats');
}

/* ── ui/flow.js：接章時不要跳回底部，保住使用者正在看的位置 ── */
{
  const f = p('ui/flow.js');
  let s = fs.readFileSync(f, 'utf8');
  must(s, "    var thread = document.querySelector('#stream .thread');", 'flow thread');
  s = s.replace(
    "    var thread = document.querySelector('#stream .thread');",
    "    var thread = document.querySelector('#stream .thread');\n    var keepTop = stream.scrollTop;      // 使用者正在看的位置"
  );
  must(s, "      if (body && /試讀|免費範圍外/.test(body.textContent)) blocked = true;", 'flow blocked');
  s = s.replace(
    "      if (body && /試讀|免費範圍外/.test(body.textContent)) blocked = true;",
    "      if (body && /試讀|免費範圍外/.test(body.textContent)) blocked = true;\n"
    + "      // goChapter 會自動捲到底；這裡還原回去，讓讀的人自己決定速度\n"
    + "      requestAnimationFrame(function () { stream.scrollTop = keepTop; });\n"
    + "      setTimeout(function () { stream.scrollTop = keepTop; }, 80);"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('ui/flow.js ok');
}
