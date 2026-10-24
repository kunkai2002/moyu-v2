'use strict';

/* 書評（書層級評論）— 走 APP 網關 /novel/commentapi/*
   移植自 fanqie-assistant/src/api/comment.ts，只保留讀取。 */

const api = require('./appapi');

const COMMENT_TYPE_REVIEW = 2;
const GROUP_TYPE_BOOK = 1;
const SOURCE_BOOK = 1;

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);

function parseScoreText(raw) {
  if (typeof raw?.intro === 'string' && raw.intro) {
    try {
      const p = JSON.parse(raw.intro);
      if (p?.title_name) return str(p.title_name);
    } catch {}
  }
  return str(raw?.zh_title || raw?.en_title);
}

function parseUser(raw) {
  const base = raw?.base_info || {};
  const tag = raw?.user_tag || {};
  return {
    id: str(base.user_id || raw?.user_id),
    name: str(base.user_name) || '匿名',
    avatar: str(base.user_avatar),
    isAuthor: Boolean(tag.is_author),
    isVip: Boolean(tag.is_vip || tag.is_blue_vip),
    titles: Array.isArray(tag.user_title_info)
      ? tag.user_title_info.map(parseScoreText).filter(Boolean)
      : [],
  };
}

function parseItem(cell) {
  const c = cell?.comment || cell;
  const id = str(c?.comment_id);
  if (!id) return null;
  const common = c?.common || c?.Common || {};
  const content = common.content || {};
  const stat = c?.stat || {};
  return {
    id,
    text: str(content.text),
    time: int(common.create_timestamp),
    user: parseUser(common.user_info),
    likes: int(stat.digg_count),
    replies: int(stat.reply_count),
    isAuthorStick: Boolean(c?.user_action?.is_author_stick),
    score: int(c?.expand?.score),
  };
}

/**
 * 取書評列表。
 * @param {string} bookId
 * @param {{sort?: 1|3, count?: number, cursor?: string}} opts  sort 1=最熱 3=最新
 */
async function getBookComments(bookId, opts = {}) {
  const { sort = 1, count = 20, cursor } = opts;
  const body = {
    business_param: {
      book_id: bookId,
      need_count: true,
      fold_type: 1,
    },
    comment_source: SOURCE_BOOK,
    comment_type: COMMENT_TYPE_REVIEW,
    count: Math.min(count, 100),
    group_id: bookId,
    group_type: GROUP_TYPE_BOOK,
    server_channel: 5,
    sort,
    ...(cursor ? { cursor } : {}),
  };

  const j = await api.appRootPost(`/novel/commentapi/comment/list/${bookId}/v1`, body);
  if (j.code !== 0) throw new Error(`書評接口 code=${j.code} ${j.message || ''}`);

  const d = j.data || {};
  const info = d.common_list_info || {};
  const extra = d.extra || {};
  const list = Array.isArray(d.data_list) ? d.data_list : [];

  return {
    comments: list.map(parseItem).filter(Boolean),
    cursor: str(info.cursor),
    hasMore: Boolean(info.has_more),
    total: int(info.total),
    scoreText: str(extra.score_text),
    scoreCount: int(extra.score_cnt),
  };
}

module.exports = { getBookComments };
