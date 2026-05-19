import { getDb } from '../db.js';
function toStoredListing(row) {
    const { rawJson, ...listing } = row;
    return { ...listing, rawJson: rawJson ? JSON.parse(rawJson) : undefined };
}
export class ListingRepository {
    async create(input) {
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
        return toStoredListing(db.prepare('SELECT * FROM listings WHERE id = ?').get(id));
    }
    async findComparables(input, limit = 25) {
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
        });
        return rows.map(toStoredListing);
    }
}
export const listingRepository = new ListingRepository();
