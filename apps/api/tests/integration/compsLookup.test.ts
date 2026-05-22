import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'car-value-comps-route-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.sqlite');
  vi.resetModules();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js');
  closeDb();
  vi.unstubAllGlobals();
  delete process.env.DATABASE_PATH;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('/api/comps/lookup', () => {
  it('returns ranked cached DOM comparables and uses in-memory cache', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { comparableListingRepository } = await import('../../src/repositories/comparableListingRepository.js');
    for (const [idx, price] of [21500, 20500, 22500, 23000, 21000].entries()) {
      comparableListingRepository.upsertFromListing({
        platform: 'craigslist',
        sourceUrl: `https://newyork.craigslist.org/cto/d/camry/${idx}.html`,
        title: `2020 Toyota Camry ${idx}`,
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
        trim: idx % 2 ? 'LE' : 'SE',
        mileage: 41000 + idx * 1000,
        priceUsd: price,
        location: 'New York',
        rawJson: { source: 'test' }
      });
    }

    const { buildApp } = await import('../../src/app.js');
    const app = await buildApp();
    const payload = { platform: 'generic', sourceUrl: 'https://example.com/listing', year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE', mileage: 42000, priceUsd: 21900, zip: '10001' };
    const res = await app.inject({ method: 'POST', url: '/api/comps/lookup', payload });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.status).toBe('complete');
    expect(body.sourcesChecked).toEqual(['cached-dom']);
    expect(body.comps.length).toBeGreaterThanOrEqual(4);
    expect(body.freshCount).toBe(0);
    expect(body.cachedCount).toBe(body.comps.length);

    const cached = await app.inject({ method: 'POST', url: '/api/comps/lookup', payload });
    expect(cached.json().cachedCount).toBe(body.comps.length);
    expect(fetchMock).not.toHaveBeenCalled();
    await app.close();
  });
});
