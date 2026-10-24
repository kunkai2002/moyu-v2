// 加入 /api/stats（閱讀統計）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const sp = path.join(ROOT, 'server.js');
let s = fs.readFileSync(sp, 'utf8');
if (s.includes("'/api/stats'")) { console.log('= 已存在'); process.exit(0); }

const anchor = "    if (p === '/api/health') {";
const route = `    if (p === '/api/stats') {
      const f = path.join(DATA_DIR, 'stats.json');
      const db = store.readJson(f, { days: {} });
      if (req.method === 'POST') {
        const r = await readBody(req);
        const d = new Date().toISOString().slice(0, 10);
        const day = db.days[d] || { chars: 0, chapters: 0, seconds: 0 };
        day.chars += Number(r.chars) || 0;
        day.chapters += 1;
        day.seconds += Number(r.seconds) || 0;
        db.days[d] = day;
        store.writeJson(f, db);
        return json(res, 200, { ok: true, today: day });
      }
      const keys = Object.keys(db.days).sort();
      const today = db.days[new Date().toISOString().slice(0, 10)] || { chars: 0, chapters: 0, seconds: 0 };
      const last7 = keys.slice(-7).map((k) => ({ date: k, ...db.days[k] }));
      const total = keys.reduce((a, k) => ({
        chars: a.chars + db.days[k].chars,
        chapters: a.chapters + db.days[k].chapters,
        seconds: a.seconds + db.days[k].seconds,
      }), { chars: 0, chapters: 0, seconds: 0 });
      return json(res, 200, { ok: true, today, last7, total, days: keys.length });
    }

${anchor}`;

if (!s.includes(anchor)) { console.log('! 錨點沒中'); process.exit(1); }
fs.writeFileSync(sp, s.replace(anchor, route), 'utf8');
console.log('+ /api/stats');
