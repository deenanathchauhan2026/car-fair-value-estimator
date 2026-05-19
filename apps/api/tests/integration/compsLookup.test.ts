import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'car-value-comps-route-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.sqlite');
  process.env.ENABLE_TEST_SCRAPING = 'true';
  vi.resetModules();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js');
  closeDb();
  vi.unstubAllGlobals();
  delete process.env.DATABASE_PATH;
  delete process.env.ENABLE_TEST_SCRAPING;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('/api/comps/lookup', () => {
  it('scrapes once per source, ranks comps, and uses in-memory cache', async () => {
    const html = `<li class="cl-static-search-result"><a href="https://newyork.craigslist.org/cto/d/camry/1.html"><div class="title">2020 Toyota Camry SE</div><div class="price">$21,500</div><div class="location">New York</div><span>41,000 miles</span></a></li>
      <li class="cl-static-search-result"><a href="https://newyork.craigslist.org/cto/d/camry/2.html"><div class="title">2020 Toyota Camry LE</div><div class="price">$20,500</div><div class="location">New York</div><span>45,000 miles</span></a></li>`;
    const truecarPayload = { props: { pageProps: { listings: [
      { url: '/used-cars-for-sale/listing/a/', year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE', listPrice: 22500, mileage: 40000 },
      { url: '/used-cars-for-sale/listing/b/', year: 2020, make: 'Toyota', model: 'Camry', trim: 'XSE', listPrice: 23000, mileage: 38000 }
    ] } } };
    const autolist = `<script>window.__AUTOLIST__ = {"listings":[{"url":"/listings/1","year":2020,"make":"Toyota","model":"Camry","trim":"SE","price":21000,"mileage":42000},{"url":"/listings/2","year":2020,"make":"Toyota","model":"Camry","trim":"LE","price":20000,"mileage":46000}]};</script>`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(truecarPayload)}</script>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(autolist, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { buildApp } = await import('../../src/app.js');
    const app = await buildApp();
    const payload = { platform: 'generic', sourceUrl: 'https://example.com/listing', year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE', mileage: 42000, priceUsd: 21900, zip: '10001' };
    const res = await app.inject({ method: 'POST', url: '/api/comps/lookup', payload });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.status).toBe('complete');
    expect(body.sourcesChecked).toEqual(['craigslist', 'truecar', 'autolist']);
    expect(body.comps.length).toBeGreaterThanOrEqual(4);
    expect(body.freshCount).toBeGreaterThanOrEqual(4);

    const cached = await app.inject({ method: 'POST', url: '/api/comps/lookup', payload });
    expect(cached.json().cachedCount).toBe(body.comps.length);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await app.close();
  });
});
