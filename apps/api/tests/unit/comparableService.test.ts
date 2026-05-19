import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'car-value-comps-test-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.sqlite');
  vi.resetModules();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js');
  closeDb();
  delete process.env.DATABASE_PATH;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('ComparableService layered fallbacks', () => {
  it('uses an exact seeded mileage bucket when no local comparables exist', async () => {
    const { comparableService } = await import('../../src/services/comparableService.js');

    const estimate = await comparableService.estimate({
      platform: 'generic',
      sourceUrl: 'https://example.com/escape',
      year: 2017,
      make: 'Ford',
      model: 'Escape',
      mileage: 102000,
      priceUsd: 9500
    });

    expect(estimate.estimateKind).toBe('seed-exact');
    expect(estimate.confidenceTier).toBe('medium');
    expect(estimate.fairValueMedian).toBeGreaterThan(0);
    expect(estimate.comparables[0]?.title).toContain('2017 Ford Escape');
  });

  it('falls back to a nearby seeded year and adjusts value by 6% per year', async () => {
    const { comparableService } = await import('../../src/services/comparableService.js');

    const estimate = await comparableService.estimate({
      platform: 'generic',
      sourceUrl: 'https://example.com/camry-older',
      year: 2014,
      make: 'Toyota',
      model: 'Camry',
      mileage: 90000
    });

    expect(estimate.estimateKind).toBe('seed-nearby');
    expect(estimate.confidenceTier).toBe('low-medium');
    expect(estimate.estimateSource).toContain('adjusted');
  });

  it('uses listing price as a low-confidence final fallback', async () => {
    const { comparableService } = await import('../../src/services/comparableService.js');

    const estimate = await comparableService.estimate({
      platform: 'generic',
      sourceUrl: 'https://example.com/unknown',
      year: 2020,
      make: 'NotARealMake',
      model: 'Nope',
      priceUsd: 12345
    });

    expect(estimate.estimateKind).toBe('listing-fallback');
    expect(estimate.confidenceTier).toBe('low');
    expect(estimate.fairValueMedian).toBe(12300);
  });
});
