import type { ComparableListing, ListingInput } from '@car-value/shared';
import { comparableListingRepository } from '../repositories/comparableListingRepository.js';
import { normalizeVehicle } from '../scrapers/normalizeListing.js';
import { rankAndFilterComparables } from '../scrapers/scoreComparable.js';

export type ComparableSource = 'cached-dom';

export type CompsLookupResponse = {
  status: 'complete';
  comps: ComparableListing[];
  sourcesChecked: ComparableSource[];
  freshCount: number;
  cachedCount: number;
};

type CacheEntry = { expiresAt: number; comps: ComparableListing[]; sourcesChecked: ComparableSource[] };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;

export class CompsLookupService {
  async lookup(input: ListingInput & { zip?: string }): Promise<CompsLookupResponse> {
    const vehicle = normalizeVehicle(input);
    const cacheKey = keyFor(vehicle, input.sourceUrl);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { status: 'complete', comps: cached.comps, sourcesChecked: cached.sourcesChecked, freshCount: 0, cachedCount: cached.comps.length };
    }

    if (!vehicle.make || !vehicle.model) {
      return { status: 'complete', comps: [], sourcesChecked: ['cached-dom'], freshCount: 0, cachedCount: 0 };
    }

    const stored = comparableListingRepository.findRecentComparables(vehicle.make, vehicle.model, vehicle.year, {
      excludeSourceUrl: input.sourceUrl,
      limit: 25,
      maxAgeDays: 30
    });
    const comps = rankAndFilterComparables(vehicle, stored, 8).slice(0, 8);
    cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, comps, sourcesChecked: ['cached-dom'] });
    return { status: 'complete', comps, sourcesChecked: ['cached-dom'], freshCount: 0, cachedCount: comps.length };
  }

  clearCache() { cache.clear(); }
}

function keyFor(vehicle: { year?: number; make?: string; model?: string; zip?: string }, sourceUrl?: string) {
  return [vehicle.year ?? '', vehicle.make ?? '', vehicle.model ?? '', vehicle.zip ?? '', sourceUrl ?? ''].map((x) => String(x).toLowerCase()).join(':');
}

export const compsLookupService = new CompsLookupService();
