-- 魔芋一夏 · 同步 schema（D1 / SQLite）
-- 套用：npx wrangler d1 execute moyu-sync --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS progress (
  book_id    TEXT PRIMARY KEY,
  chapter_id TEXT,
  chapter_no TEXT,
  title      TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0,
  device     TEXT
);

CREATE TABLE IF NOT EXISTS marks (
  id            TEXT PRIMARY KEY,
  book_id       TEXT NOT NULL,
  chapter_id    TEXT,
  chapter_title TEXT,
  para          INTEGER DEFAULT 0,
  text          TEXT,
  note          TEXT,
  type          TEXT DEFAULT 'highlight',
  updated_at    INTEGER NOT NULL DEFAULT 0,
  device        TEXT,
  deleted       INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_marks_book ON marks(book_id);
CREATE INDEX IF NOT EXISTS idx_marks_updated ON marks(updated_at);
