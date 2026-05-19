import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'car-value-test-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.sqlite');
  vi.resetModules();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js');
  closeDb();
  delete process.env.DATABASE_PATH;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('valuation route', () => {
  it('loads seed market data and returns source metadata', async () => {
    const { buildApp } = await import('../../src/app.js');
    const { getDb } = await import('../../src/db.js');
    const app = await buildApp();

    const seedCount = (getDb().prepare('SELECT COUNT(*) AS count FROM market_value_seed').get() as { count: number }).count;
    expect(seedCount).toBeGreaterThan(1000);

    const res = await app.inject({
      method: 'POST',
      url: '/api/valuations',
      payload: {
        listing: {
          platform: 'generic',
          sourceUrl: 'https://example.com/listing',
          year: 2020,
          make: 'Toyota',
          model: 'Camry',
          mileage: 42000,
          priceUsd: 21000
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().valuation.fairValueMedian).toBeGreaterThan(0);
    expect(res.json().estimateSource).toContain('market data');
    expect(res.json().valuation.estimateSource).toContain('market data');
    expect(res.json().valuation.confidenceTier).toBe('medium');
    await app.close();
  });

  it('returns a seeded estimate for a 2017 Ford Escape around 100k miles', async () => {
    const { buildApp } = await import('../../src/app.js');
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/valuations',
      payload: {
        listing: {
          platform: 'generic',
          sourceUrl: 'https://example.com/ford-escape',
          year: 2017,
          make: 'Ford',
          model: 'Escape',
          mileage: 101500,
          priceUsd: 9200
        }
      }
    });

    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.valuation.fairValueMedian).toBeGreaterThan(0);
    expect(body.valuation.comparableCount).toBe(1);
    expect(body.valuation.confidenceTier).toBe('medium');
    expect(body.valuation.metadata.method).toBe('seed-exact');
    await app.close();
  });
});
