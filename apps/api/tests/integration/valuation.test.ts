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
  it('returns valuation response', async () => {
    const { buildApp } = await import('../../src/app.js');
    const app = await buildApp();

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
          priceUsd: 21000
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().valuation.fairValueMedian).toBeGreaterThan(0);
    await app.close();
  });
});
