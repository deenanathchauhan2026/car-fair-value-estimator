import { config } from '../config.js';
import { apiCacheRepository } from '../repositories/apiCacheRepository.js';
import type {
  MarketCheckListing,
  MarketCheckPredictedPrice,
  MarketCheckSearchInput,
  MarketCheckSearchResponse,
  MarketCheckVinDecode
} from './marketcheckTypes.js';

const PROVIDER = 'marketcheck';
type RequestStats = { cached: boolean; fresh: boolean };

export class MarketCheckClient {
  private lastRequestStats: RequestStats = { cached: false, fresh: false };

  constructor(
    private readonly options = config.marketcheck,
    private readonly cache = apiCacheRepository
  ) {}

  getLastRequestStats(): RequestStats {
    return this.lastRequestStats;
  }

  async searchListings(input: MarketCheckSearchInput): Promise<MarketCheckListing[]> {
    if (!this.options.enabled || !input.make || !input.model) return [];
    const payload = await this.request<MarketCheckSearchResponse>('/v2/search/car/active', {
      year: input.year,
      make: input.make,
      model: input.model,
      trim: input.trim,
      vin: input.vin,
      zip: input.zip,
      radius: input.radius ?? 100,
      rows: input.rows ?? 25
    }, searchCacheKey(input));
    return Array.isArray(payload?.listings) ? payload.listings : [];
  }

  async decodeVin(vin: string): Promise<MarketCheckVinDecode | undefined> {
    const normalized = vin.trim().toUpperCase();
    if (!this.options.enabled || !/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) return undefined;
    return this.request<MarketCheckVinDecode>(`/v2/decode/car/${encodeURIComponent(normalized)}/specs`, {}, `marketcheck:v1:decode:${normalized}`);
  }

  async getPredictedPrice(input: MarketCheckSearchInput): Promise<MarketCheckPredictedPrice | undefined> {
    if (!this.options.enabled || !input.make || !input.model) return undefined;
    const payload = await this.request<MarketCheckSearchResponse>('/v2/search/car/active', {
      year: input.year,
      make: input.make,
      model: input.model,
      trim: input.trim,
      zip: input.zip,
      radius: input.radius ?? 100,
      stats: 'price',
      rows: 0
    }, predictedPriceCacheKey(input));

    return normalizePredictedPrice(payload?.stats);
  }

  private async request<T>(path: string, params: Record<string, unknown>, cacheKey: string): Promise<T | undefined> {
    this.lastRequestStats = { cached: false, fresh: false };
    const cached = this.cache.getCached<T>(PROVIDER, cacheKey);
    if (cached !== null) {
      this.lastRequestStats = { cached: true, fresh: false };
      return cached;
    }

    if (!this.options.apiKey || !this.cache.canCallProvider(PROVIDER, this.options.monthlyLimit)) return undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(path, this.options.baseUrl);
      url.searchParams.set('api_key', this.options.apiKey);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        if ([401, 403, 429].includes(response.status) || response.status >= 500) {
          console.warn(`MarketCheck request failed with status ${response.status}`);
        }
        return undefined;
      }

      const json = (await response.json()) as T;
      this.cache.setCached(PROVIDER, cacheKey, json, this.options.cacheTtlHours);
      this.cache.incrementMonthlyUsage(PROVIDER);
      this.lastRequestStats = { cached: false, fresh: true };
      return json;
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network error';
      console.warn(`MarketCheck request failed: ${message}`);
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function searchCacheKey(input: MarketCheckSearchInput): string {
  return [
    'marketcheck:v1:search',
    input.year ?? '',
    lower(input.make),
    lower(input.model),
    lower(input.trim),
    upper(input.vin),
    input.zip ?? '',
    input.radius ?? 100,
    input.rows ?? 25
  ].join(':');
}

function predictedPriceCacheKey(input: MarketCheckSearchInput): string {
  return ['marketcheck:v1:predicted-price', input.year ?? '', lower(input.make), lower(input.model), lower(input.trim), input.zip ?? '', input.radius ?? 100].join(':');
}

function normalizePredictedPrice(stats: unknown): MarketCheckPredictedPrice | undefined {
  if (!stats || typeof stats !== 'object') return undefined;
  const container = stats as Record<string, unknown>;
  const priceStats = (container.price && typeof container.price === 'object' ? container.price : container) as Record<string, unknown>;
  const predicted = toNumber(priceStats.predicted_price) ?? toNumber(priceStats.avg) ?? toNumber(priceStats.mean) ?? toNumber(priceStats.median);
  if (!predicted) return undefined;
  return {
    predicted_price: Math.round(predicted),
    range_low: toNumber(priceStats.range_low) ?? toNumber(priceStats.min),
    range_high: toNumber(priceStats.range_high) ?? toNumber(priceStats.max),
    confidence: priceStats.confidence as string | number | undefined
  };
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
const lower = (value?: string) => value?.trim().toLowerCase() ?? '';
const upper = (value?: string) => value?.trim().toUpperCase() ?? '';

export const marketCheckClient = new MarketCheckClient();
