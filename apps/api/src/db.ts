import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import { config } from './config.js';

let db: Database.Database | undefined;

export function getDb() {
  if (!db) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    seedMarketValues(db);
  }
  return db;
}

export function closeDb() {
  db?.close();
  db = undefined;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      sourceUrl TEXT NOT NULL,
      title TEXT,
      priceUsd REAL,
      year INTEGER,
      make TEXT,
      model TEXT,
      trim TEXT,
      mileage REAL,
      vin TEXT,
      location TEXT,
      condition TEXT,
      sellerType TEXT,
      rawJson TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_listings_comparables
      ON listings (lower(make), lower(model), year, priceUsd, createdAt);

    CREATE TABLE IF NOT EXISTS valuations (
      id TEXT PRIMARY KEY,
      listingId TEXT NOT NULL,
      fairValueLow REAL NOT NULL,
      fairValueHigh REAL NOT NULL,
      fairValueMedian REAL NOT NULL,
      confidenceScore REAL NOT NULL,
      comparableCount INTEGER NOT NULL,
      comparables TEXT NOT NULL,
      metadata TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (listingId) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS market_value_seed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      trim TEXT,
      mileage_min INTEGER,
      mileage_max INTEGER,
      condition TEXT DEFAULT 'good',
      market_low INTEGER NOT NULL,
      market_median INTEGER NOT NULL,
      market_high INTEGER NOT NULL,
      source TEXT DEFAULT 'seed',
      confidence TEXT DEFAULT 'medium'
    );

    CREATE INDEX IF NOT EXISTS idx_seed_vehicle ON market_value_seed(make, model, year);
    CREATE INDEX IF NOT EXISTS idx_seed_mileage ON market_value_seed(make, model, year, mileage_min, mileage_max);

    CREATE TABLE IF NOT EXISTS comparable_listings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_url TEXT,
      title TEXT,
      platform TEXT,
      vin TEXT,
      condition TEXT,
      seller_type TEXT,
      listed_at TEXT,
      domain TEXT,
      year INTEGER,
      make TEXT,
      model TEXT,
      trim TEXT,
      normalized_make TEXT,
      normalized_model TEXT,
      normalized_trim TEXT,
      mileage REAL,
      price REAL NOT NULL,
      location TEXT,
      zip TEXT,
      first_seen_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now')),
      raw_payload TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_comparable_listings_source_url_unique
      ON comparable_listings(source_url)
      WHERE source_url IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_comparable_listings_vehicle
      ON comparable_listings (normalized_make, normalized_model, year, last_seen_at);

    CREATE TABLE IF NOT EXISTS api_usage (
      provider TEXT NOT NULL,
      period TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (provider, period)
    );

    CREATE TABLE IF NOT EXISTS api_response_cache (
      provider TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      response_json TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (provider, cache_key)
    );
  `);

  for (const statement of [
    'ALTER TABLE comparable_listings ADD COLUMN title TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN platform TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN vin TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN condition TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN seller_type TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN listed_at TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN domain TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN normalized_make TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN normalized_model TEXT',
    'ALTER TABLE comparable_listings ADD COLUMN normalized_trim TEXT'
  ]) {
    try { database.exec(statement); } catch {}
  }
}

function seedMarketValues(database: Database.Database) {
  const existing = database.prepare('SELECT COUNT(*) AS count FROM market_value_seed').get() as { count: number };
  if (existing.count > 0) return;

  const seedPath = join(dirname(fileURLToPath(import.meta.url)), '../data/market_value_seed.json');
  const rows = JSON.parse(readFileSync(seedPath, 'utf8')) as Array<Record<string, unknown>>;
  const insert = database.prepare(`
    INSERT INTO market_value_seed (
      make, model, year, trim, mileage_min, mileage_max, condition,
      market_low, market_median, market_high, source, confidence
    ) VALUES (
      @make, @model, @year, @trim, @mileage_min, @mileage_max, @condition,
      @market_low, @market_median, @market_high, @source, @confidence
    )
  `);

  const tx = database.transaction((items: Array<Record<string, unknown>>) => {
    for (const row of items) insert.run(row);
  });
  tx(rows);
}
