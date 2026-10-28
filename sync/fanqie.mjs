/**
 * 魔芋一夏 · 番茄取數（Cloudflare Worker 版）
 * 由 src/fanqie.js / src/shelf.js 移植：只保留網頁路線（APP 網關在 Worker 上沒有簽名堆疊）
 * ─────────────────────────────────────────────────────────────
 * 字體混淆：正文常見字被換成 PUA 碼點（U+E000–U+F8FF），
 * charset[i] 對應 U+E3E8+i，逐字換回即可。
 */

import CHARSET from './charset.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ORIGIN = 'https://fanqienovel.com';
const PUA_BASE = 0xe3e8;

/* ── HTTP ── */
export async function fqGet(url, cookie, extraHeaders) {
  const headers = {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: ORIGIN + '/',
    ...extraHeaders,
  };
  if (cookie) {
    headers.Cookie = cookie;
    headers['Sec-Fetch-Site'] = 'same-origin';
    headers['Sec-Fetch-Mode'] = 'navigate';
  }
  const r = await fetch(url, { headers, redirect: 'follow' });
  const text = await r.text();
  return { status: r.status, body: text };
}

/* ── 解碼 ── */
function scoreText(s) {
  let bad = 0, total = 0;
  for (const ch of s) {
    total++;
    if (/[A-Za-z0-9]/.test(ch)) bad++;
  }
  return total ? bad / total : 1;
}

function applyTable(text, table) {
  let out = '';
  let unmapped = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      const i = cp - PUA_BASE;
      if (i >= 0 && i < table.length && table[i]) out += table[i];
      else { out += ch; unmapped++; }
    } else out += ch;
  }
  return { text: out, unmapped };
}

export function deobfuscate(text) {
  const tables = Array.isArray(CHARSET) ? CHARSET : [];
  if (!tables.length) return { text, table: -1 };
  let best = { text, table: -1, unmapped: Infinity, score: Infinity };
  tables.forEach((t, idx) => {
    if (!Array.isArray(t) || !t.length) return;
    const r = applyTable(text, t);
    const s = scoreText(r.text);
    if (r.unmapped < best.unmapped || (r.unmapped === best.unmapped && s < best.score)) {
      best = { text: r.text, table: idx, unmapped: r.unmapped, score: s };
    }
  });
  return best;
}

/* ── HTML 小工具 ── */
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(s) {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
}

export function parseBookId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{6,}$/.test(s)) return s;
  const m = s.match(/(?:\/page\/|\/reader\/|book_id=)(\d{6,})/);
  if (m) return m[1];
  const m2 = s.match(/(\d{16,20})/);
  return m2 ? m2[1] : null;
}

/* ── 開書 ── */
export async function openBook(input, cookie) {
  const id = parseBookId(input);
  if (!id) throw new Error('認不出書號');

  const r = await fqGet(`${ORIGIN}/page/${id}`, cookie);
  if (r.status !== 200) throw new Error(`書頁打不開（HTTP ${r.status}）`);
  const html = r.body;

  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleM ? stripTags(titleM[1]) : `書 ${id}`;

  const authorM = html.match(/"authorName":"([^"]{1,30})"/)
    || html.match(/"author":"([^"]{1,30})"/)
    || html.match(/class="[^"]*author[^"]*"[^>]*>([^<]{1,30})</i);
  const author = authorM ? stripTags(authorM[1]) : '';

  const coverM = html.match(/<meta property="og:image" content="([^"]+)"/);
  let cover = coverM ? coverM[1] : '';
  if (cover.startsWith('//')) cover = 'https:' + cover;

  const chapters = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a[^>]+href="\/reader\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const cid = m[1];
    if (seen.has(cid)) continue;
    const raw = stripTags(m[2]);
    if (!raw || raw.length > 60) continue;
    if (/^最近更新/.test(raw)) continue;
    const noM = raw.match(/^第\s*(\d+)/);
    if (!noM) continue;
    seen.add(cid);
    chapters.push({ id: cid, no: noM[1], title: raw });
  }
  if (!chapters.length) throw new Error('抓不到目錄（可能頁面結構改了）');

  return { book: { id, title, author, cover, chapters, total: chapters.length } };
}

/* ── 章節 ── */
export async function loadChapter(bookId, chapterId, cookie) {
  const r = await fqGet(`${ORIGIN}/reader/${chapterId}`, cookie);
  if (r.status !== 200) throw new Error(`章節打不開（HTTP ${r.status}）`);
  const html = r.body;

  const titleM = html.match(/<h1[^>]*class="[^"]*muye-reader-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleM ? stripTags(titleM[1]) : '';

  let body = '';
  const cm = html.match(/<div class="muye-reader-content[^"]*">\s*<div>([\s\S]*?)<\/div>\s*<\/div>/);
  if (cm) body = cm[1];
  else {
    const cm2 = html.match(/<div class="muye-reader-content[^"]*">([\s\S]*?)<\/div>/);
    if (cm2) body = cm2[1];
  }

  const paragraphs = [];
  for (const p of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = stripTags(p[1]);
    if (t) paragraphs.push(t);
  }

  if (!paragraphs.length) {
    const needPay = /needPay|需购买|購買後|付费/.test(html);
    throw new Error(needPay ? '這一章需要付費' : '抓不到正文');
  }

  const decoded = paragraphs.map((p) => deobfuscate(p).text);
  const chars = decoded.reduce((n, p) => n + p.length, 0);
  const previewOnly = chars < 400 && /SVIP|購買後|付费|解鎖/.test(html);

  return { chapterId, bookId, title, paragraphs: decoded, chars, previewOnly };
}

/* ── 書架 ── */
const Q = 'aid=1967&iid=0&version_code=57700&update_version_code=57700';
const norm = (u) => (u && u.startsWith('//') ? 'https:' + u : u);

export async function getShelf(cookie) {
  if (!cookie) throw new Error('還沒登入（先在桌面版掃碼，再同步到這裡）');

  const r1 = await fqGet(`${ORIGIN}/reading/bookapi/bookshelf/info/v:version/?${Q}`, cookie,
    { Accept: 'application/json, text/plain, */*' });
  let j1 = null;
  try { j1 = JSON.parse(r1.body); } catch {}
  const list = j1?.data?.book_shelf_info;
  if (!Array.isArray(list)) throw new Error('書架讀不到（cookie 可能過期）');
  if (!list.length) return { books: [], total: 0 };

  const r2 = await fqGet(`${ORIGIN}/api/reader/book/progress`, cookie,
    { Accept: 'application/json, text/plain, */*' });
  let j2 = null;
  try { j2 = JSON.parse(r2.body); } catch {}
  const progress = Array.isArray(j2?.data) ? j2.data : [];

  const items = list.map((it) => {
    const p = progress.find((x) => String(x.book_id) === String(it.book_id));
    return {
      id: String(it.book_id),
      chapterId: p ? String(p.item_id) : '0',
      readAt: p ? Number(p.read_timestamp) || 0 : 0,
      addedAt: Number(it.add_shelf_time) || 0,
    };
  });

  try {
    const r3 = await fetch(`${ORIGIN}/api/bookshelf/multidetail?${Q}`, {
      method: 'POST',
      headers: {
        'User-Agent': UA, 'Content-Type': 'application/json', Referer: ORIGIN + '/',
        Accept: 'application/json, text/plain, */*', Cookie: cookie,
      },
      body: JSON.stringify({ books: items.map((b) => ({ book_id: b.id, item_id: b.chapterId })) }),
    });
    const j3 = await r3.json().catch(() => null);
    const details = j3?.data?.detail_list;
    if (Array.isArray(details)) {
      for (const it of items) {
        const d = details.find((x) => String(x.book_id) === String(it.id));
        if (!d) continue;
        it.title = d.book_name || '';
        it.author = d.author_name || '';
        it.cover = norm(d.thumb_url || '');
        it.chapterTitle = d.item_show_title || '';
        it.chapterOrder = d.real_chapter_order || 0;
        it.totalChapters = d.serial_count || 0;
      }
    }
  } catch {}

  return { books: items.filter((b) => b.title), total: items.length };
}
