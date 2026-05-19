import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'marketcheck-test-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.sqlite');
  process.env.MARKETCHECK_API_KEY = 'test-key';
  process.env.MARKETCHECK_BASE_URL = 'https://api.marketcheck.test';
  process.env.MARKETCHECK_MONTHLY_LIMIT = '500';
  process.env.MARKETCHECK_CACHE_TTL_HOURS = '24';
  vi.resetModules();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js');
  closeDb();
  vi.unstubAllGlobals();
  delete process.env.DATABASE_PATH;
  delete process.env.MARKETCHECK_API_KEY;
  delete process.env.MARKETCHECK_BASE_URL;
  delete process.env.MARKETCHECK_MONTHLY_LIMIT;
  delete process.env.MARKETCHECK_CACHE_TTL_HOURS;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('MarketCheckClient', () => {
  it('searches active listings and caches responses without spending quota on cache hits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ listings: [listing()] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { MarketCheckClient } = await import('../../src/api/marketcheck.js');
    const { apiCacheRepository } = await import('../../src/repositories/apiCacheRepository.js');
    const client = new MarketCheckClient();

    const first = await client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '10001' });
    const second = await client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '10001' });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(apiCacheRepository.getMonthlyUsage('marketcheck')).toBe(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api_key=test-key');
  });

  it('decodes valid VINs and skips invalid VINs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ vin: '1HGCM82633A004352', year: 2003, make: 'Honda', model: 'Accord' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { MarketCheckClient } = await import('../../src/api/marketcheck.js');
    const client = new MarketCheckClient();

    await expect(client.decodeVin('bad')).resolves.toBeUndefined();
    const decoded = await client.decodeVin('1HGCM82633A004352');

    expect(decoded?.make).toBe('Honda');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes predicted price stats', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ stats: { price: { avg: 21400, min: 19000, max: 24000, confidence: 'medium' } } }), { status: 200 })));
    const { MarketCheckClient } = await import('../../src/api/marketcheck.js');
    const client = new MarketCheckClient();

    const price = await client.getPredictedPrice({ year: 2021, make: 'Honda', model: 'Civic' });

    expect(price).toEqual({ predicted_price: 21400, range_low: 19000, range_high: 24000, confidence: 'medium' });
  });

  it('enforces the monthly rate limit after a successful live request', async () => {
    process.env.MARKETCHECK_MONTHLY_LIMIT = '1';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ listings: [listing()] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { MarketCheckClient } = await import('../../src/api/marketcheck.js');
    const client = new MarketCheckClient();

    const first = await client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '10001' });
    const limited = await client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '90210' });

    expect(first).toHaveLength(1);
    expect(limited).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns safe empty results for API and network failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { MarketCheckClient } = await import('../../src/api/marketcheck.js');
    const client = new MarketCheckClient();

    await expect(client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '1' })).resolves.toEqual([]);
    await expect(client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '2' })).resolves.toEqual([]);
    await expect(client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '3' })).resolves.toEqual([]);
    await expect(client.searchListings({ year: 2020, make: 'Toyota', model: 'Camry', zip: '4' })).resolves.toEqual([]);
    warn.mockRestore();
  });
});

describe('normalizeMarketCheckListing', () => {
  it('maps MarketCheck fields into internal comparables and rejects incomplete rows', async () => {
    const { normalizeMarketCheckListing } = await import('../../src/api/marketcheckNormalize.js');
    const vehicle = { year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE', zip: '10001' };

    const normalized = normalizeMarketCheckListing(listing(), vehicle);

    expect(normalized?.id).toBe('marketcheck:abc');
    expect(normalized?.platform).toBe('generic');
    expect(normalized?.rawJson).toMatchObject({ source: 'marketcheck' });
    expect(normalizeMarketCheckListing({ ...listing(), price: undefined }, vehicle)).toBeNull();
    expect(normalizeMarketCheckListing({ ...listing(), vdp_url: undefined }, vehicle)).toBeNull();
  });
});

function listing() {
  return {
    id: 'abc',
    vin: '1HGCM82633A004352',
    heading: '2020 Toyota Camry SE',
    price: 21000,
    miles: 42000,
    vdp_url: 'https://dealer.example/camry',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    trim: 'SE',
    dealer: { city: 'New York', state: 'NY', zip: '10001' }
  };
}
