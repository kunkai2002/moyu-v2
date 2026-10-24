// 第二批：書籤 / 劃線 / 筆記（純前端注入 + 伺服器端儲存）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── server.js：/api/marks ── */
const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (!s.includes("'/api/marks'")) {
  const anchor = "    if (p === '/api/health') {";
  const route = `    if (p === '/api/marks') {
      const f = path.join(DATA_DIR, 'marks.json');
      const all = store.readJson(f, {});
      if (req.method === 'GET') {
        const bookId = u.searchParams.get('book');
        return json(res, 200, { ok: true, marks: bookId ? (all[bookId] || []) : all });
      }
      const m = await readBody(req);
      const list = all[m.bookId] || [];
      if (m.action === 'remove') {
        all[m.bookId] = list.filter((x) => x.id !== m.id);
      } else {
        const id = m.id || (m.chapterId + '-' + m.para + '-' + m.type);
        const i = list.findIndex((x) => x.id === id);
        const rec = { ...m, id, at: Date.now() };
        if (i >= 0) list[i] = rec; else list.push(rec);
        all[m.bookId] = list;
      }
      store.writeJson(f, all);
      return json(res, 200, { ok: true });
    }

${anchor}`;
  if (s.includes(anchor)) { s = s.replace(anchor, route); fs.writeFileSync(sp, s, 'utf8'); console.log('+ /api/marks'); }
} else console.log('= /api/marks 已存在');

/* ── index.html：掛 wiring4 ── */
const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring4.js')) {
  h = h.replace('<script src="wiring3.js"></script>', '<script src="wiring3.js"></script>\n<script src="wiring4.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring4');
}

/* ── pack4.js：加入檔案 ── */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring4')) {
  p = p.replace("'ui/wiring3.js',", "'ui/wiring3.js', 'ui/wiring4.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring4');
}
