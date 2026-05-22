import type { ComparableListing, ListingInput } from '@car-value/shared';
import { getDb } from '../db.js';
import { listingRepository } from '../repositories/listingRepository.js';
import { compsLookupService } from './compsLookupService.js';

export type EstimateKind = 'cached-dom' | 'local' | 'seed-exact' | 'seed-nearby' | 'listing-fallback';
export type ConfidenceTier = 'high' | 'medium' | 'low-medium' | 'low';

export type ComparableEstimate = {
  comparables: ComparableListing[];
  fairValueLow?: number;
  fairValueMedian?: number;
  fairValueHigh?: number;
  estimateKind: EstimateKind;
  confidenceTier: ConfidenceTier;
  estimateSource: string;
};

type SeedRow = {
  id: number;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  mileage_min: number | null;
  mileage_max: number | null;
  condition: string | null;
  market_low: number;
  market_median: number;
  market_high: number;
  source: string | null;
  confidence: string | null;
};

export class ComparableService {
  async find(listing: ListingInput): Promise<ComparableListing[]> {
    return (await this.estimate(listing)).comparables;
  }

  async estimate(listing: ListingInput): Promise<ComparableEstimate> {
    const cachedDom = await compsLookupService.lookup(listing).catch(() => undefined);
    if (cachedDom && cachedDom.comps.length >= 4) {
      return {
        comparables: cachedDom.comps,
        estimateKind: 'cached-dom',
        confidenceTier: cachedDom.comps.length >= 6 ? 'high' : 'medium',
        estimateSource: `Based on ${cachedDom.comps.length} cached comparable listing${cachedDom.comps.length === 1 ? '' : 's'} from extension-observed listings`
      };
    }

    const localComparables = await this.findLocalExactComparables(listing);
    if (localComparables.length > 0) {
      return {
        comparables: localComparables.slice(0, 12),
        estimateKind: 'local',
        confidenceTier: localComparables.length >= 5 ? 'high' : 'low-medium',
        estimateSource: `Based on ${localComparables.length} recent local comparable${localComparables.length === 1 ? '' : 's'}`
      };
    }

    const exactSeed = this.findExactSeed(listing);
    if (exactSeed) {
      return this.fromSeed(exactSeed, 'seed-exact', 'medium', 'Based on market data for similar vehicles');
    }

    const nearbySeed = this.findNearbySeed(listing);
    if (nearbySeed) {
      const yearDelta = listing.year && nearbySeed.year ? listing.year - nearbySeed.year : 0;
      const adjustment = 1 + yearDelta * 0.06;
      return this.fromSeed(
        nearbySeed,
        'seed-nearby',
        'low-medium',
        `Based on market data for a ${nearbySeed.year} ${nearbySeed.make} ${nearbySeed.model}, adjusted for model year`,
        adjustment
      );
    }

    const price = listing.priceUsd && listing.priceUsd > 0 ? listing.priceUsd : 20000;
    return {
      comparables: [],
      fairValueLow: Math.round((price * 0.9) / 100) * 100,
      fairValueMedian: Math.round(price / 100) * 100,
      fairValueHigh: Math.round((price * 1.1) / 100) * 100,
      estimateKind: 'listing-fallback',
      confidenceTier: 'low',
      estimateSource: 'Low-confidence estimate based on the listing price because no market match was found'
    };
  }

  private async findLocalExactComparables(listing: ListingInput): Promise<ComparableListing[]> {
    if (!listing.make || !listing.model || !listing.year) return [];

    try {
      const rows = await listingRepository.findComparables(listing, 50);
      return rows
        .filter((row) => {
          if (!same(row.make, listing.make) || !same(row.model, listing.model) || row.year !== listing.year) return false;
          if (listing.trim && row.trim && !same(row.trim, listing.trim)) return false;
          if (listing.mileage && row.mileage) {
            const mileageDelta = Math.abs(row.mileage - listing.mileage) / Math.max(listing.mileage, 1);
            if (mileageDelta > 0.15) return false;
          }
          if (listing.sourceUrl && row.sourceUrl === listing.sourceUrl) return false;
          return true;
        })
        .map((x) => ({
          id: x.id,
          platform: x.platform as ComparableListing['platform'],
          sourceUrl: x.sourceUrl,
          title: x.title ?? undefined,
          priceUsd: x.priceUsd ?? undefined,
          year: x.year ?? undefined,
          make: x.make ?? undefined,
          model: x.model ?? undefined,
          trim: x.trim ?? undefined,
          mileage: x.mileage ?? undefined,
          vin: x.vin ?? undefined,
          location: x.location ?? undefined,
          condition: x.condition ?? undefined,
          sellerType: x.sellerType ?? undefined,
          rawJson: x.rawJson ?? undefined,
          similarityScore: 0.95
        }));
    } catch {
      return [];
    }
  }

  private findExactSeed(listing: ListingInput): SeedRow | undefined {
    if (!listing.make || !listing.model || !listing.year) return undefined;
    const mileage = listing.mileage ?? 45000;
    return getDb()
      .prepare(
        `SELECT * FROM market_value_seed
         WHERE lower(make) = lower(@make)
           AND lower(model) = lower(@model)
           AND year = @year
           AND @mileage >= COALESCE(mileage_min, 0)
           AND (@mileage < mileage_max OR mileage_max IS NULL)
         ORDER BY mileage_min DESC
         LIMIT 1`
      )
      .get({ make: listing.make, model: listing.model, year: listing.year, mileage }) as SeedRow | undefined;
  }

  private findNearbySeed(listing: ListingInput): SeedRow | undefined {
    if (!listing.make || !listing.model) return undefined;
    const mileage = listing.mileage ?? 45000;
    const targetYear = listing.year ?? new Date().getFullYear();
    return getDb()
      .prepare(
        `SELECT * FROM market_value_seed
         WHERE lower(make) = lower(@make)
           AND lower(model) = lower(@model)
           AND year BETWEEN @minYear AND @maxYear
           AND @mileage >= COALESCE(mileage_min, 0)
           AND (@mileage < mileage_max OR mileage_max IS NULL)
         ORDER BY ABS(year - @targetYear), mileage_min DESC
         LIMIT 1`
      )
      .get({ make: listing.make, model: listing.model, targetYear, minYear: targetYear - 1, maxYear: targetYear + 1, mileage }) as SeedRow | undefined;
  }

  private fromSeed(
    seed: SeedRow,
    estimateKind: EstimateKind,
    confidenceTier: ConfidenceTier,
    estimateSource: string,
    adjustment = 1
  ): ComparableEstimate {
    const adjust = (value: number) => Math.max(500, Math.round((value * adjustment) / 100) * 100);
    const comparable: ComparableListing = {
      id: `seed-${seed.id}`,
      platform: 'generic',
      sourceUrl: 'https://example.com/market-data-seed',
      title: `${seed.year} ${seed.make} ${seed.model}${seed.trim ? ` ${seed.trim}` : ''} market baseline`,
      priceUsd: adjust(seed.market_median),
      year: seed.year,
      make: seed.make,
      model: seed.model,
      trim: seed.trim ?? undefined,
      mileage: midpoint(seed.mileage_min, seed.mileage_max),
      condition: seed.condition ?? undefined,
      rawJson: {
        marketLow: adjust(seed.market_low),
        marketMedian: adjust(seed.market_median),
        marketHigh: adjust(seed.market_high),
        source: seed.source ?? 'seed',
        confidence: seed.confidence ?? 'medium'
      },
      similarityScore: estimateKind === 'seed-exact' ? 0.82 : 0.68
    };

    return {
      comparables: [comparable],
      fairValueLow: adjust(seed.market_low),
      fairValueMedian: adjust(seed.market_median),
      fairValueHigh: adjust(seed.market_high),
      estimateKind,
      confidenceTier,
      estimateSource
    };
  }
}

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const midpoint = (min?: number | null, max?: number | null) => {
  if (typeof min === 'number' && typeof max === 'number') return Math.round((min + max) / 2);
  if (typeof min === 'number') return min + 25000;
  return undefined;
};

export const comparableService = new ComparableService();
