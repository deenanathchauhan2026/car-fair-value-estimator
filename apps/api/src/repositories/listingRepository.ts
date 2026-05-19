import type { ListingInput } from '@car-value/shared';
import { getDb } from '../db.js';

type ListingRow = {
  id: string;
  platform: string;
  sourceUrl: string;
  title: string | null;
  priceUsd: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  vin: string | null;
  location: string | null;
  condition: string | null;
  sellerType: string | null;
  rawJson: string | null;
  createdAt: string;
};

export type StoredListing = Omit<ListingRow, 'rawJson'> & { rawJson?: unknown };

function toStoredListing(row: ListingRow): StoredListing {
  const { rawJson, ...listing } = row;
  return { ...listing, rawJson: rawJson ? JSON.parse(rawJson) : undefined };
}

export class ListingRepository {
  async create(input: ListingInput) {
    const id = crypto.randomUUID();
    const db = getDb();
    db.prepare(`
      INSERT INTO listings (
        id, platform, sourceUrl, title, priceUsd, year, make, model, trim,
        mileage, vin, location, condition, sellerType, rawJson, createdAt
      ) VALUES (
        @id, @platform, @sourceUrl, @title, @priceUsd, @year, @make, @model, @trim,
        @mileage, @vin, @location, @condition, @sellerType, @rawJson, @createdAt
      )
    `).run({
      id,
      platform: input.platform,
      sourceUrl: input.sourceUrl,
      title: input.title ?? null,
      priceUsd: input.priceUsd ?? null,
      year: input.year ?? null,
      make: input.make ?? null,
      model: input.model ?? null,
      trim: input.trim ?? null,
      mileage: input.mileage ?? null,
      vin: input.vin ?? null,
      location: input.location ?? null,
      condition: input.condition ?? null,
      sellerType: input.sellerType ?? null,
      rawJson: input.rawJson === undefined ? null : JSON.stringify(input.rawJson),
      createdAt: new Date().toISOString()
    });

    return toStoredListing(db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as ListingRow);
  }

  async findComparables(input: ListingInput, limit = 25) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM listings
      WHERE lower(make) = lower(@make)
        AND lower(model) = lower(@model)
        AND (@year IS NULL OR year BETWEEN @minYear AND @maxYear)
        AND priceUsd IS NOT NULL
      ORDER BY createdAt DESC
      LIMIT @limit
    `).all({
      make: input.make ?? '',
      model: input.model ?? '',
      year: input.year ?? null,
      minYear: input.year ? input.year - 1 : null,
      maxYear: input.year ? input.year + 1 : null,
      limit
    }) as ListingRow[];

    return rows.map(toStoredListing);
  }
}

export const listingRepository = new ListingRepository();
