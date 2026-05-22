import { config } from '../config.js';
import { apiCacheRepository } from '../repositories/apiCacheRepository.js';
import { isLikelyVin } from '../utils/vin.js';

const PROVIDER = 'nhtsa-vpic';
const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/';

export type VpicDecodedVin = {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyClass?: string;
  engine?: string;
  fuelType?: string;
  driveType?: string;
};

type VpicResult = { Variable?: string; Value?: string | null; ValueId?: string | null };
type VpicResponse = { Results?: VpicResult[] };

export class NhtsaVpicClient {
  constructor(private readonly cache: typeof apiCacheRepository = apiCacheRepository) {}

  async decodeVin(vin: string): Promise<VpicDecodedVin | undefined> {
    const normalized = vin.trim().toUpperCase();
    if (!isLikelyVin(normalized)) return undefined;

    const cacheKey = `nhtsa-vpic:v1:decode:${normalized}`;
    const cached = this.cache.getCached<VpicDecodedVin>(PROVIDER, cacheKey);
    if (cached !== null) return hasUsefulData(cached) ? cached : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${BASE_URL}${encodeURIComponent(normalized)}?format=json`, {
        signal: controller.signal,
        headers: { accept: 'application/json' }
      });
      if (!response.ok) return undefined;
      const payload = (await response.json()) as VpicResponse;
      const decoded = normalizeVpicResults(payload.Results ?? []);
      if (!hasUsefulData(decoded)) return undefined;
      this.cache.setCached(PROVIDER, cacheKey, decoded, config.nhtsaVpic.cacheTtlHours);
      return decoded;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function normalizeVpicResults(results: VpicResult[]): VpicDecodedVin {
  const byName = new Map(results.map((item) => [item.Variable?.trim().toLowerCase() ?? '', item.Value?.trim() ?? '']));
  const yearValue = byName.get('model year');
  const displacementL = firstNonEmpty(byName.get('displacement (l)'), byName.get('displacement (cc)') ? `${Number(byName.get('displacement (cc)')) / 1000}` : undefined);
  const cylinders = byName.get('engine number of cylinders');
  return cleanDecoded({
    year: yearValue && /^\d{4}$/.test(yearValue) ? Number(yearValue) : undefined,
    make: byName.get('make'),
    model: byName.get('model'),
    trim: firstNonEmpty(byName.get('trim'), byName.get('series')),
    bodyClass: byName.get('body class'),
    engine: firstNonEmpty(byName.get('engine model'), [displacementL ? `${roundOne(displacementL)}L` : undefined, cylinders ? `${cylinders} cyl` : undefined].filter(Boolean).join(' ')),
    fuelType: firstNonEmpty(byName.get('fuel type - primary'), byName.get('fuel type - secondary')),
    driveType: byName.get('drive type')
  });
}

function cleanDecoded(decoded: VpicDecodedVin): VpicDecodedVin {
  return Object.fromEntries(Object.entries(decoded).filter(([, value]) => value !== undefined && value !== null && value !== '')) as VpicDecodedVin;
}

function hasUsefulData(decoded: VpicDecodedVin): boolean {
  return Boolean(decoded.year || decoded.make || decoded.model);
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== '');
}

function roundOne(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Math.round(numeric * 10) / 10) : value;
}

export const nhtsaVpicClient = new NhtsaVpicClient();
