import type { NormalizedVehicle, ScrapedComparable } from './normalizeListing.js';
import { normalizeListing } from './normalizeListing.js';
import { scraperHeaders, waitForSourceCooldown } from './rateLimit.js';

export async function scrapeAutoList(vehicle: NormalizedVehicle): Promise<ScrapedComparable[]> {
  if (!vehicle.make || !vehicle.model) return [];
  try {
    await waitForSourceCooldown('autolist');
    const url = buildAutoListUrl(vehicle);
    const res = await fetch(url, { headers: scraperHeaders });
    if (!res.ok) return [];
    return parseAutoListHtml(await res.text(), vehicle);
  } catch {
    return [];
  }
}

export function parseAutoListHtml(html: string, vehicle: NormalizedVehicle): ScrapedComparable[] {
  const out: ScrapedComparable[] = [];
  const jsonMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?(?:window\.__|listing|vehicles)[\s\S]*?)<\/script>/gi)];
  for (const match of jsonMatches) {
    for (const blob of extractObjects(match[1])) {
      try { collect(JSON.parse(blob), vehicle, out); } catch {}
    }
  }
  // Fallback for card markup.
  for (const match of html.matchAll(/<a[^>]+href="([^"]*(?:\/listings\/|\/cars\/)[^"]*)"[\s\S]{0,2500}?(?:\$([\d,]+))[\s\S]{0,600}?([\d,]+)\s*(?:mi|miles)/gi)) {
    const block = match[0];
    const title = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const listing = normalizeListing({ source: 'autolist', sourceUrl: match[1], title, price: match[2], mileage: match[3], rawPayload: block }, vehicle);
    if (listing && !out.some((x) => x.sourceUrl === listing.sourceUrl)) out.push(listing);
  }
  return out.slice(0, 12);
}

function buildAutoListUrl(vehicle: NormalizedVehicle) {
  const query = encodeURIComponent([vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '));
  const zip = vehicle.zip ? `&location=${encodeURIComponent(vehicle.zip)}` : '';
  return `https://www.autolist.com/listings#q=${query}${zip}`;
}

function collect(node: unknown, vehicle: NormalizedVehicle, out: ScrapedComparable[]) {
  if (!node || out.length >= 12) return;
  if (Array.isArray(node)) { for (const x of node) collect(x, vehicle, out); return; }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const url = str(obj.url) ?? str(obj.vdp_url) ?? str(obj.detail_url) ?? str(obj.permalink);
  const price = num(obj.price) ?? num(obj.list_price);
  if (url && price) {
    const listing = normalizeListing({ source: 'autolist', sourceUrl: url, title: str(obj.title) ?? str(obj.heading), price, year: num(obj.year), make: str(obj.make), model: str(obj.model), trim: str(obj.trim), mileage: num(obj.mileage), location: str(obj.location), rawPayload: obj }, vehicle);
    if (listing && !out.some((x) => x.sourceUrl === listing.sourceUrl)) out.push(listing);
  }
  for (const value of Object.values(obj)) collect(value, vehicle, out);
}

function extractObjects(script: string): string[] {
  const candidates: string[] = [];
  for (const m of script.matchAll(/(\{[\s\S]{20,}\}|\[[\s\S]{20,}\])/g)) candidates.push(m[1].replace(/;\s*$/, ''));
  return candidates;
}
const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : undefined;
const num = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^0-9.]/g, '')) || undefined : undefined;
