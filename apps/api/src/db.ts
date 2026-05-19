import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { config } from './config.js';

let db: Database.Database | undefined;

export function getDb() {
  if (!db) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
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
  `);
}
