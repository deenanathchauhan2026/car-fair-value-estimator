import type { ComparableListing } from '@car-value/shared';
import { getDb } from '../db.js';

export type FindRecentComparableOptions = {
  year?: number;
  limit?: number;
  excludeSourceUrl?: string;
  maxAgeDays?: number;
};

type ComparableRow = {
  id: string;
  source: string;
  source_url: string | null;
  title: string | null;
  platform: ComparableListing['platform'] | null;
  vin: string | null;
  condition: string | null;
  seller_type: string | null;
  listed_at: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  price: number;
  location: string | null;
  raw_payload: string | null;
};

export class ComparableListingRepository {
  upsertFromListing(listing: ComparableListing): void {
    if (!listing.sourceUrl || !listing.priceUsd) return;
    const source = sourceOf(listing);
    getDb().prepare(`
      INSERT INTO comparable_listings (
        id, source, source_url, title, platform, vin, condition, seller_type, listed_at, domain,
        year, make, model, trim, normalized_make, normalized_model, normalized_trim,
        mileage, price, location, raw_payload, last_seen_at
      ) VALUES (
        @id, @source, @source_url, @title, @platform, @vin, @condition, @seller_type, @listed_at, @domain,
        @year, @make, @model, @trim, @normalized_make, @normalized_model, @normalized_trim,
        @mileage, @price, @location, @raw_payload, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        platform=excluded.platform,
        vin=excluded.vin,
        condition=excluded.condition,
        seller_type=excluded.seller_type,
        listed_at=excluded.listed_at,
        domain=excluded.domain,
        year=excluded.year,
        make=excluded.make,
        model=excluded.model,
        trim=excluded.trim,
        normalized_make=excluded.normalized_make,
        normalized_model=excluded.normalized_model,
        normalized_trim=excluded.normalized_trim,
        mileage=excluded.mileage,
        price=excluded.price,
        location=excluded.location,
        raw_payload=excluded.raw_payload,
        last_seen_at=datetime('now')
    `).run({
      id: listing.id ?? listing.sourceUrl,
      source,
      source_url: listing.sourceUrl,
      title: listing.title ?? null,
      platform: listing.platform,
      vin: listing.vin ?? null,
      condition: listing.condition ?? null,
      seller_type: listing.sellerType ?? null,
      listed_at: listing.listedAt ?? null,
      domain: domainOf(listing.sourceUrl),
      year: listing.year ?? null,
      make: listing.make ?? null,
      model: listing.model ?? null,
      trim: listing.trim ?? null,
      normalized_make: normalize(listing.make),
      normalized_model: normalize(listing.model),
      normalized_trim: normalize(listing.trim),
      mileage: listing.mileage ?? null,
      price: listing.priceUsd,
      location: listing.location ?? null,
      raw_payload: listing.rawJson === undefined ? null : JSON.stringify(listing.rawJson)
    });
  }

  findRecentComparables(make: string, model: string, year?: number, options: FindRecentComparableOptions = {}): ComparableListing[] {
    const rows = getDb().prepare(`
      SELECT * FROM comparable_listings
      WHERE normalized_make = @make
        AND normalized_model = @model
        AND (@year IS NULL OR year BETWEEN @minYear AND @maxYear)
        AND (@excludeSourceUrl IS NULL OR source_url != @excludeSourceUrl)
        AND last_seen_at >= datetime('now', @maxAge)
      ORDER BY last_seen_at DESC
      LIMIT @limit
    `).all({
      make: normalize(make),
      model: normalize(model),
      year: year ?? null,
      minYear: year ? year - 1 : null,
      maxYear: year ? year + 1 : null,
      excludeSourceUrl: options.excludeSourceUrl ?? null,
      maxAge: `-${options.maxAgeDays ?? 30} days`,
      limit: options.limit ?? 25
    }) as ComparableRow[];
    return rows.map(rowToComparable);
  }

  pruneOlderThan(days: number): number {
    return getDb().prepare("DELETE FROM comparable_listings WHERE last_seen_at < datetime('now', @age)").run({ age: `-${days} days` }).changes;
  }

  count(): number {
    const row = getDb().prepare('SELECT COUNT(*) AS count FROM comparable_listings').get() as { count: number };
    return row.count;
  }
}

function rowToComparable(row: ComparableRow): ComparableListing {
  return {
    id: row.id,
    platform: row.platform ?? 'generic',
    sourceUrl: row.source_url ?? '',
    title: row.title ?? undefined,
    priceUsd: row.price,
    year: row.year ?? undefined,
    make: row.make ?? undefined,
    model: row.model ?? undefined,
    trim: row.trim ?? undefined,
    mileage: row.mileage ?? undefined,
    vin: row.vin ?? undefined,
    location: row.location ?? undefined,
    condition: row.condition ?? undefined,
    sellerType: row.seller_type ?? undefined,
    listedAt: row.listed_at ?? undefined,
    rawJson: row.raw_payload ? JSON.parse(row.raw_payload) : undefined
  };
}

function sourceOf(listing: ComparableListing): string {
  return listing.platform === 'generic' ? domainOf(listing.sourceUrl) ?? 'cached-dom' : listing.platform;
}

function domainOf(sourceUrl?: string): string | null {
  if (!sourceUrl) return null;
  try { return new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { return null; }
}

function normalize(value?: string): string | null {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? null;
}

export const comparableListingRepository = new ComparableListingRepository();
