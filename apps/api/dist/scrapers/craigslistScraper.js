import { normalizeListing, toNumber } from './normalizeListing.js';
import { scraperHeaders, waitForSourceCooldown } from './rateLimit.js';
export async function scrapeCraigslist(vehicle) {
    if (!vehicle.make || !vehicle.model)
        return [];
    try {
        await waitForSourceCooldown('craigslist');
        const url = buildCraigslistUrl(vehicle);
        const res = await fetch(url, { headers: scraperHeaders });
        if (!res.ok)
            return [];
        return parseCraigslistHtml(await res.text(), vehicle);
    }
    catch {
        return [];
    }
}
export function parseCraigslistHtml(html, vehicle) {
    const results = [];
    const seen = new Set();
    const patterns = [
        /<li[^>]*class="[^"]*cl-static-search-result[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[\s\S]*?<div[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?(?:<div[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/div>)?[\s\S]*?<\/li>/gi,
        /<li[^>]*class="[^"]*result-row[^"]*"[^>]*>[\s\S]*?<a[^>]+class="[^"]*result-title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class="[^"]*result-price[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?(?:<span[^>]*class="[^"]*result-hood[^"]*"[^>]*>([\s\S]*?)<\/span>)?/gi
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) && results.length < 12) {
            const [, sourceUrl, title, price, location] = match;
            if (seen.has(sourceUrl))
                continue;
            seen.add(sourceUrl);
            const block = match[0];
            const mileage = block.match(/([\d,]+)\s*(?:mi|miles)/i)?.[1];
            const listing = normalizeListing({ source: 'craigslist', sourceUrl, title: strip(title), price: toNumber(price), mileage, location: strip(location), rawPayload: block }, vehicle);
            if (listing)
                results.push(listing);
        }
    }
    return results;
}
function buildCraigslistUrl(vehicle) {
    const query = encodeURIComponent([vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '));
    const base = vehicle.zip ? `https://geo.craigslist.org/iso/us?query=${query}&postal=${vehicle.zip}` : `https://sfbay.craigslist.org/search/cta?query=${query}`;
    return base.includes('geo.') ? base : `${base}&sort=date`;
}
const strip = (value) => value?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
