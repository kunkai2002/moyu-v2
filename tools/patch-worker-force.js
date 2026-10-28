// /push 支援 force（以本機為準覆蓋），用來救回被手機蓋掉的進度
const fs = require('fs');
const f = 'sync/worker.mjs';
let s = fs.readFileSync(f, 'utf8');
const must = (a, t) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + t); process.exit(1); } };

must("    if (p === '/push' && req.method === 'POST') {", 'push route');
if (!s.includes('const force')) {
  s = s.replace(
    "      const device = String(body.device || 'unknown').slice(0, 40);",
    "      const device = String(body.device || 'unknown').slice(0, 40);\n"
    + "      const force = body.force === true;   // 以本機為準（救援用）"
  );

  // 進度：force 時無條件覆蓋
  must(`        await env.DB.prepare(
          \`INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(book_id) DO UPDATE SET
             chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
             title=excluded.title, updated_at=excluded.updated_at, device=excluded.device
           WHERE excluded.updated_at > progress.updated_at\`,
        ).bind(pr.book_id, pr.chapter_id || '', pr.chapter_no || '',
          pr.title || '', Number(pr.updated_at) || now, device).run();`, 'progress upsert');

  s = s.replace(`        await env.DB.prepare(
          \`INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(book_id) DO UPDATE SET
             chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
             title=excluded.title, updated_at=excluded.updated_at, device=excluded.device
           WHERE excluded.updated_at > progress.updated_at\`,
        ).bind(pr.book_id, pr.chapter_id || '', pr.chapter_no || '',
          pr.title || '', Number(pr.updated_at) || now, device).run();`,
  `        const prSql = force
          ? \`INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(book_id) DO UPDATE SET
               chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
               title=excluded.title, updated_at=excluded.updated_at, device=excluded.device\`
          : \`INSERT INTO progress (book_id, chapter_id, chapter_no, title, updated_at, device)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(book_id) DO UPDATE SET
               chapter_id=excluded.chapter_id, chapter_no=excluded.chapter_no,
               title=excluded.title, updated_at=excluded.updated_at, device=excluded.device
             WHERE excluded.updated_at > progress.updated_at\`;
        await env.DB.prepare(prSql).bind(pr.book_id, pr.chapter_id || '', pr.chapter_no || '',
          pr.title || '', Number(pr.updated_at) || now, device).run();`);

  fs.writeFileSync(f, s, 'utf8');
  console.log('worker.mjs: /push 支援 force');
} else console.log('worker 已有 force');
