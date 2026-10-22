'use strict';

/* ══════════════════════════════════════════════════════════════
   番茄小說取數 ＋ 字體混淆還原
   ─────────────────────────────────────────────────────────────
   網頁閱讀頁的正文是 SSR 的，但常用字會被換成 PUA 碼點
   （U+E000–U+F8FF），再用自訂字體把字形畫回去。
   解法：碼表 charset[i] 對應 U+E3E8+i，逐字換回來即可。
   ══════════════════════════════════════════════════════════════ */

const https = require('https');
const fs = require('fs');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ORIGIN = 'https://fanqienovel.com';
const PUA_BASE = 0xe3e8;

let charsetPath = '';
let charsetCache = null;

function setCharsetPath(p) { charsetPath = p; charsetCache = null; }

function loadCharset() {
  if (charsetCache) return charsetCache;
  try {
    charsetCache = JSON.parse(fs.readFileSync(charsetPath, 'utf8'));
  } catch {
    charsetCache = [];
  }
  return charsetCache;
}

/* ── HTTP ───────────────────────────────────────────────────── */
function request(url, cookie, depth = 0) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Referer: ORIGIN + '/',
    };
    if (cookie) {
      headers['Cookie'] = cookie;
      headers['Sec-Fetch-Site'] = 'same-origin';
      headers['Sec-Fetch-Mode'] = 'navigate';
    }
    const req = https.get(url, { headers }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && depth < 5) {
        r.resume();
        return resolve(request(new URL(r.headers.location, url).href, cookie, depth + 1));
      }
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve({
        status: r.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('連線逾時')));
  });
}

/* ── 解碼 ───────────────────────────────────────────────────── */

/** 讓一段文字「像不像正常中文」：字母與數字越多越可疑 */
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
    } else {
      out += ch;
    }
  }
  return { text: out, unmapped };
}

/** 自動挑最合適的碼表版本（官方會輪換字體） */
function deobfuscate(text) {
  const tables = loadCharset();
  if (!tables.length) return { text, table: -1, unmapped: 0 };

  let best = { text, table: -1, unmapped: Infinity, score: Infinity };
  tables.forEach((t, idx) => {
    if (!Array.isArray(t) || !t.length) return;
    const r = applyTable(text, t);
    // 先比未映射數量，再比字母殘留率
    const s = scoreText(r.text);
    const better = r.unmapped < best.unmapped || (r.unmapped === best.unmapped && s < best.score);
    if (better) best = { text: r.text, table: idx, unmapped: r.unmapped, score: s };
  });
  return best;
}

/* ── HTML 小工具 ────────────────────────────────────────────── */
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

/* ── 書籍 ───────────────────────────────────────────────────── */

function parseBookId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{6,}$/.test(s)) return s;
  const m = s.match(/(?:\/page\/|\/reader\/|book_id=)(\d{6,})/);
  if (m) return m[1];
  const m2 = s.match(/(\d{16,20})/);
  return m2 ? m2[1] : null;
}

async function openBook(input, cookie) {
  const id = parseBookId(input);
  if (!id) throw new Error('認不出書號，請貼番茄的書頁網址或純數字 id');

  const r = await request(`${ORIGIN}/page/${id}`, cookie);
  if (r.status !== 200) throw new Error(`書頁打不開（HTTP ${r.status}）`);
  const html = r.body;

  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleM ? stripTags(titleM[1]) : `書 ${id}`;

  const authorM = html.match(/"authorName":"([^"]{1,30})"/)
    || html.match(/"author":"([^"]{1,30})"/)
    || html.match(/class="[^"]*author[^"]*"[^>]*>([^<]{1,30})</i)
    || html.match(/<meta name="author" content="([^"]+)"/);
  const author = authorM ? stripTags(authorM[1]) : '';

  const coverM = html.match(/<meta property="og:image" content="([^"]+)"/);
  let cover = coverM ? coverM[1] : '';
  if (cover.startsWith('//')) cover = 'https:' + cover;

  // 章節連結
  const chapters = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a[^>]+href="\/reader\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const cid = m[1];
    if (seen.has(cid)) continue;
    const raw = stripTags(m[2]);
    if (!raw || raw.length > 60) continue;
    // 頁首那條「最近更新：第 N 章 …」不是目錄項
    if (/^最近更新/.test(raw)) continue;
    // 目錄項一定以「第 N」開頭（有些標題少打了「章」字，別因此漏掉）
    const noM = raw.match(/^第\s*(\d+)/);
    if (!noM) continue;
    seen.add(cid);
    chapters.push({ id: cid, no: noM[1], title: raw });
  }

  if (!chapters.length) throw new Error('這頁抓不到目錄（可能要登入，或頁面結構改了）');

  return {
    book: { id, title, author, cover, chapters, total: chapters.length },
  };
}

/* ── 章節 ───────────────────────────────────────────────────── */

async function loadChapter(bookId, chapterId, cookie) {
  // ① 先走 APP 網關：匿名裝置簽名，拿到的是完整正文（不受網頁 SVIP 預覽限制）
  try {
    const appapi = require('./appapi');
    const r = await appapi.getChapter(chapterId);
    if (r.paragraphs.length) {
      const decoded = r.paragraphs.map((p) => deobfuscate(p).text);
      const chars = decoded.reduce((n, p) => n + p.length, 0);
      return {
        chapterId, bookId, title: r.title || '',
        paragraphs: decoded, chars,
        previewOnly: false,
        source: 'app',
        prev: null, next: null,
      };
    }
  } catch (e) {
    // 網關失敗就退回網頁版（至少還有預覽）
    if (process.env.MOYU_DEBUG) console.log('[app-api]', e.message);
  }

  const r = await request(`${ORIGIN}/reader/${chapterId}`, cookie);
  if (r.status !== 200) throw new Error(`章節打不開（HTTP ${r.status}）`);
  const html = r.body;

  const titleM = html.match(/<h1[^>]*class="[^"]*muye-reader-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const rawTitle = titleM ? stripTags(titleM[1]) : '';

  // 正文容器
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
    // 可能是未購買 / 需要登入的章節
    const needPay = /needPay|需购买|購買後|付费/.test(html);
    throw new Error(needPay ? '這一章需要付費才能讀' : '抓不到正文（可能要登入，或頁面結構改了）');
  }

  const decoded = paragraphs.map((p) => deobfuscate(p).text);
  const chars = decoded.reduce((n, p) => n + p.length, 0);

  // 網頁端沒 SVIP 只給一小段預覽（~150 字），頁面會掛一個「SVIP 網頁暢讀」的遮罩。
  // 這不是解析錯誤，是官方限制，要老實告訴使用者。
  const previewOnly = chars < 400 && (
    /muye-to-vip|scan-gradient|SVIP|扫码下载APP/.test(html)
  );

  // 上／下一章
  const prevM = html.match(/href="\/reader\/(\d+)"[^>]*>[\s\S]{0,40}上一章/);
  const nextM = html.match(/href="\/reader\/(\d+)"[^>]*>[\s\S]{0,40}下一章/);

  return {
    chapterId,
    bookId,
    title: rawTitle,
    paragraphs: decoded,
    chars,
    previewOnly,
    prev: prevM ? prevM[1] : null,
    next: nextM ? nextM[1] : null,
  };
}

module.exports = {
  setCharsetPath,
  openBook,
  loadChapter,
  parseBookId,
  deobfuscate,
  request,
};
