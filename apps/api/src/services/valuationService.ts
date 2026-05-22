import type { ListingInput, ValuationResponse } from '@car-value/shared';
import { median, percentile } from '../utils/statistics.js';
import { roundDollars } from '../utils/price.js';
import { comparableService } from './comparableService.js';
import { normalizationService } from './normalizationService.js';
import { scoringService } from './scoringService.js';
import { listingRepository } from '../repositories/listingRepository.js';
import { valuationRepository } from '../repositories/valuationRepository.js';
import { nhtsaVpicClient } from '../api/nhtsaVpic.js';
import { comparableListingRepository } from '../repositories/comparableListingRepository.js';

export class ValuationService {
  async value(input: ListingInput): Promise<ValuationResponse> {
    const normalizedInput = normalizationService.normalize(input);
    const decoded = normalizedInput.vin && (!normalizedInput.make || !normalizedInput.model || !normalizedInput.year)
      ? await nhtsaVpicClient.decodeVin(normalizedInput.vin)
      : undefined;
    const listingInput = decoded
      ? {
          ...normalizedInput,
          year: normalizedInput.year ?? decoded.year,
          make: normalizedInput.make ?? decoded.make,
          model: normalizedInput.model ?? decoded.model,
          trim: normalizedInput.trim ?? decoded.trim,
          rawJson: { ...(typeof normalizedInput.rawJson === 'object' && normalizedInput.rawJson !== null ? normalizedInput.rawJson : {}), vinDecoded: true, vinDecodeProvider: 'nhtsa-vpic' }
        }
      : normalizedInput;
    let listing: { id: string };
    try {
      listing = await listingRepository.create(listingInput);
    } catch {
      listing = { id: crypto.randomUUID() };
    }

    try {
      comparableListingRepository.upsertFromListing(listingInput);
    } catch {}

    const estimate = await comparableService.estimate(listingInput);
    const comps = estimate.comparables;
    const prices = comps.map((c) => c.priceUsd).filter((p): p is number => typeof p === 'number' && p > 0);
    const fallback = listingInput.priceUsd ?? 20000;
    const med = estimate.fairValueMedian ?? roundDollars(prices.length ? median(prices) : fallback);
    const low = estimate.fairValueLow ?? roundDollars(prices.length >= 3 ? percentile(prices, 20) : med * 0.92);
    const high = estimate.fairValueHigh ?? roundDollars(prices.length >= 3 ? percentile(prices, 80) : med * 1.08);
    const confidence = scoringService.score(listingInput, comps, estimate.estimateKind, estimate.confidenceTier);
    const data = {
      listingId: listing.id,
      fairValueLow: low,
      fairValueHigh: high,
      fairValueMedian: med,
      confidenceScore: confidence,
      comparableCount: comps.length,
      comparables: comps,
      metadata: {
        method: estimate.estimateKind,
        confidenceTier: estimate.confidenceTier,
        estimateSource: estimate.estimateSource,
        comparableSource: 'cached-dom',
        generatedFromFallback: estimate.estimateKind === 'listing-fallback',
        vinDecoded: Boolean(decoded),
        vinDecodeProvider: decoded ? 'nhtsa-vpic' : undefined
      }
    };

    let valuation: any;
    try {
      valuation = await valuationRepository.create(data);
    } catch {
      valuation = { id: crypto.randomUUID(), createdAt: new Date(), ...data };
    }
    const price = listingInput.priceUsd;
    const marketPosition = !price ? 'unknown' : price < low ? 'below' : price > high ? 'above' : 'at';
    return {
      listing: { ...listingInput, id: listing.id },
      valuation: {
        ...valuation,
        estimateSource: estimate.estimateSource,
        confidenceTier: estimate.confidenceTier,
        method: estimate.estimateKind,
        vinDecoded: Boolean(decoded),
        vinDecodeProvider: decoded ? 'nhtsa-vpic' : undefined,
        comparableSource: 'cached-dom',
        createdAt: valuation.createdAt.toISOString?.() ?? valuation.createdAt
      },
      marketPosition,
      estimateSource: estimate.estimateSource
    };
  }
}

export const valuationService = new ValuationService();
