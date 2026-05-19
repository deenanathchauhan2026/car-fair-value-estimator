import { describe, expect, it } from 'vitest';
import { scoringService } from '../../src/services/scoringService.js';

describe('scoringService', () => {
  it('scores richer listings higher with legacy comparable scoring', () => {
    const low = scoringService.score({ platform: 'generic', sourceUrl: 'https://x.test' }, []);
    const high = scoringService.score(
      {
        platform: 'generic',
        sourceUrl: 'https://x.test',
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
        trim: 'SE',
        vin: '1HGCM82633A004352',
        mileage: 40000,
        location: 'NY'
      },
      Array.from({ length: 6 }, () => ({ platform: 'generic', sourceUrl: 'https://c.test', priceUsd: 20000 }))
    );
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
  });

  it('maps approved confidence tiers to stable scores', () => {
    const listing = { platform: 'generic' as const, sourceUrl: 'https://x.test' };
    expect(scoringService.score(listing, Array.from({ length: 5 }, () => ({ platform: 'generic', sourceUrl: 'https://c.test' })), 'local', 'high')).toBe(0.9);
    expect(scoringService.score(listing, [], 'seed-exact', 'medium')).toBe(0.68);
    expect(scoringService.score(listing, [], 'seed-nearby', 'low-medium')).toBe(0.52);
    expect(scoringService.score(listing, [], 'listing-fallback', 'low')).toBe(0.3);
  });
});
