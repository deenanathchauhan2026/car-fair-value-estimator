import { describe, expect, it } from 'vitest';
import { parseAutoListHtml } from '../../src/scrapers/autolistScraper.js';
import { parseCraigslistHtml } from '../../src/scrapers/craigslistScraper.js';
import { parseTrueCarHtml } from '../../src/scrapers/truecarScraper.js';
import { rankAndFilterComparables, scoreComparable } from '../../src/scrapers/scoreComparable.js';

const vehicle = { year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE', mileage: 42000, zip: '10001' };

describe('scraper parsers', () => {
  it('parses Craigslist static search result HTML', () => {
    const html = `<li class="cl-static-search-result"><a href="https://newyork.craigslist.org/cto/d/camry/1.html"><div class="title">2020 Toyota Camry SE</div><div class="price">$21,500</div><div class="location">New York</div><span>41,000 miles</span></a></li>`;
    const [comp] = parseCraigslistHtml(html, vehicle);
    expect(comp.sourceUrl).toContain('craigslist');
    expect(comp.priceUsd).toBe(21500);
    expect(comp.mileage).toBe(41000);
  });

  it('parses TrueCar Next.js listing data', () => {
    const payload = { props: { pageProps: { listings: [{ url: '/used-cars-for-sale/listing/abc/', year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE', listPrice: 22000, mileage: 39000, dealerCity: 'Queens' }] } } };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
    const [comp] = parseTrueCarHtml(html, vehicle);
    expect(comp.sourceUrl).toContain('truecar.com');
    expect(comp.priceUsd).toBe(22000);
    expect(comp.rawJson).toMatchObject({ source: 'truecar' });
  });

  it('parses AutoList embedded listing data', () => {
    const html = `<script>window.__AUTOLIST__ = {"listings":[{"url":"/listings/xyz","year":2020,"make":"Toyota","model":"Camry","trim":"SE","price":20500,"mileage":45000,"location":"Brooklyn"}]};</script>`;
    const [comp] = parseAutoListHtml(html, vehicle);
    expect(comp.sourceUrl).toContain('autolist.com');
    expect(comp.priceUsd).toBe(20500);
  });
});

describe('comparable scoring', () => {
  it('dedupes, filters bad titles, and ranks strongest matches', () => {
    const good = { platform: 'generic' as const, sourceUrl: 'https://a.test/1', title: '2020 Toyota Camry SE', priceUsd: 21000, year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE', mileage: 43000 };
    expect(scoreComparable(vehicle, good)).toBeGreaterThan(90);
    const ranked = rankAndFilterComparables(vehicle, [good, { ...good, sourceUrl: 'https://a.test/1', mileage: 60000 }, { ...good, sourceUrl: 'https://a.test/bad', title: 'salvage Toyota Camry', priceUsd: 8000 }]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].sourceUrl).toBe('https://a.test/1');
  });
});
