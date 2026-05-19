import type { ComparableListing, ListingInput } from '@car-value/shared';
import { getDb } from '../db.js';
import { scrapeAutoList } from '../scrapers/autolistScraper.js';
import { scrapeCraigslist } from '../scrapers/craigslistScraper.js';
import { normalizeVehicle, type ScraperSource } from '../scrapers/normalizeListing.js';
import { rankAndFilterComparables } from '../scrapers/scoreComparable.js';
import { scrapeTrueCar } from '../scrapers/truecarScraper.js';

export type CompsLookupResponse = {
  status: 'complete';
  comps: ComparableListing[];
  sourcesChecked: ScraperSource[];
  freshCount: number;
  cachedCount: number;
};

type CacheEntry = { expiresAt: number; comps: ComparableListing[]; sourcesChecked: ScraperSource[] };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;

export class CompsLookupService {
  async lookup(input: ListingInput & { zip?: string }): Promise<CompsLookupResponse> {
    const vehicle = normalizeVehicle(input);
    const cacheKey = keyFor(vehicle);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { status: 'complete', comps: cached.comps, sourcesChecked: cached.sourcesChecked, freshCount: 0, cachedCount: cached.comps.length };
    }

    const cachedDb = this.findRecentStored(input, 8);
    if (cachedDb.length >= 4) {
      const comps = rankAndFilterComparables(vehicle, cachedDb, 8).slice(0, 8);
      cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, comps, sourcesChecked: [] });
      return { status: 'complete', comps, sourcesChecked: [], freshCount: 0, cachedCount: comps.length };
    }

    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_SCRAPING !== 'true') {
      return { status: 'complete', comps: [], sourcesChecked: [], freshCount: 0, cachedCount: 0 };
    }

    const sourcesChecked: ScraperSource[] = [];
    const fresh: ComparableListing[] = [];
    for (const [source, scraper] of [
      ['craigslist', scrapeCraigslist],
      ['truecar', scrapeTrueCar],
      ['autolist', scrapeAutoList]
    ] as const) {
      sourcesChecked.push(source);
      const results = await scraper(vehicle);
      fresh.push(...results);
      if (rankAndFilterComparables(vehicle, [...fresh, ...cachedDb], 8).length >= 6) break;
    }

    const comps = rankAndFilterComparables(vehicle, [...fresh, ...cachedDb], 8).slice(0, 8);
    this.storeComps(comps);
    cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, comps, sourcesChecked });
    return { status: 'complete', comps, sourcesChecked, freshCount: comps.filter((c) => fresh.some((f) => f.sourceUrl === c.sourceUrl)).length, cachedCount: comps.filter((c) => cachedDb.some((f) => f.sourceUrl === c.sourceUrl)).length };
  }

  clearCache() { cache.clear(); }

  private findRecentStored(input: ListingInput, limit: number): ComparableListing[] {
    if (!input.make || !input.model) return [];
    try {
      const rows = getDb().prepare(`
        SELECT * FROM comparable_listings
        WHERE lower(make) = lower(@make)
          AND lower(model) = lower(@model)
          AND (@year IS NULL OR year BETWEEN @minYear AND @maxYear)
          AND last_seen_at >= datetime('now', '-24 hours')
        ORDER BY last_seen_at DESC
        LIMIT @limit
      `).all({ make: input.make, model: input.model, year: input.year ?? null, minYear: input.year ? input.year - 1 : null, maxYear: input.year ? input.year + 1 : null, limit }) as Array<Record<string, unknown>>;
      return rows.map(rowToComparable);
    } catch { return []; }
  }

  private storeComps(comps: ComparableListing[]) {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO comparable_listings (id, source, source_url, year, make, model, trim, mileage, price, location, zip, raw_payload, last_seen_at)
        VALUES (@id, @source, @source_url, @year, @make, @model, @trim, @mileage, @price, @location, @zip, @raw_payload, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET price=excluded.price, mileage=excluded.mileage, location=excluded.location, raw_payload=excluded.raw_payload, last_seen_at=datetime('now')
      `);
      const tx = db.transaction((items: ComparableListing[]) => {
        for (const comp of items) stmt.run({
          id: comp.id ?? crypto.randomUUID(),
          source: sourceOf(comp),
          source_url: comp.sourceUrl ?? null,
          year: comp.year ?? null,
          make: comp.make ?? null,
          model: comp.model ?? null,
          trim: comp.trim ?? null,
          mileage: comp.mileage ?? null,
          price: comp.priceUsd,
          location: comp.location ?? null,
          zip: (comp as { zip?: string }).zip ?? null,
          raw_payload: comp.rawJson === undefined ? null : JSON.stringify(comp.rawJson)
        });
      });
      tx(comps.filter((c) => c.priceUsd && c.sourceUrl));
    } catch {}
  }
}

function rowToComparable(row: Record<string, unknown>): ComparableListing {
  return {
    id: String(row.id),
    platform: row.source === 'craigslist' ? 'craigslist' : 'generic',
    sourceUrl: row.source_url as string,
    title: [row.year, row.make, row.model, row.trim].filter(Boolean).join(' '),
    priceUsd: Number(row.price),
    year: row.year == null ? undefined : Number(row.year),
    make: row.make as string | undefined,
    model: row.model as string | undefined,
    trim: row.trim as string | undefined,
    mileage: row.mileage == null ? undefined : Number(row.mileage),
    location: row.location as string | undefined,
    rawJson: row.raw_payload ? JSON.parse(String(row.raw_payload)) : undefined
  };
}

function sourceOf(comp: ComparableListing): ScraperSource {
  const source = (comp.rawJson as { source?: ScraperSource } | undefined)?.source;
  if (source === 'craigslist' || source === 'truecar' || source === 'autolist') return source;
  return comp.platform === 'craigslist' ? 'craigslist' : 'autolist';
}

function keyFor(vehicle: { year?: number; make?: string; model?: string; zip?: string }) {
  return [vehicle.year ?? '', vehicle.make ?? '', vehicle.model ?? '', vehicle.zip ?? ''].map((x) => String(x).toLowerCase()).join(':');
}

export const compsLookupService = new CompsLookupService();
