import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'likes.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id TEXT UNIQUE NOT NULL,
      account TEXT NOT NULL,
      author_username TEXT,
      author_name TEXT,
      text TEXT,
      created_at TEXT,
      liked_at TEXT,
      has_media BOOLEAN DEFAULT 0,
      has_link BOOLEAN DEFAULT 0,
      has_article BOOLEAN DEFAULT 0,
      media_urls TEXT,
      link_urls TEXT,
      category TEXT,
      summary TEXT,
      image_description TEXT,
      link_summary TEXT,
      article_content TEXT,
      raw_json TEXT,
      processed BOOLEAN DEFAULT 0,
      digested INTEGER DEFAULT 0,
      created DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id TEXT NOT NULL,
      recommended_date TEXT NOT NULL,
      reason TEXT,
      was_liked BOOLEAN DEFAULT NULL,
      checked_at TEXT,
      created DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interest_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      keyword TEXT NOT NULL,
      weight REAL DEFAULT 1.0,
      last_updated TEXT,
      UNIQUE(category, keyword)
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY,
      account TEXT UNIQUE NOT NULL,
      last_tweet_id TEXT,
      last_sync_at TEXT
    );
  `);
}
