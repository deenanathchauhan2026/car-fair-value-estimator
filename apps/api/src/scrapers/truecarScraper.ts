import type { NormalizedVehicle, ScrapedComparable } from './normalizeListing.js';
import { normalizeListing } from './normalizeListing.js';
import { scraperHeaders, waitForSourceCooldown } from './rateLimit.js';

export async function scrapeTrueCar(vehicle: NormalizedVehicle): Promise<ScrapedComparable[]> {
  if (!vehicle.make || !vehicle.model) return [];
  try {
    await waitForSourceCooldown('truecar');
    const url = buildTrueCarUrl(vehicle);
    const res = await fetch(url, { headers: scraperHeaders });
    if (!res.ok) return [];
    return parseTrueCarHtml(await res.text(), vehicle);
  } catch {
    return [];
  }
}

export function parseTrueCarHtml(html: string, vehicle: NormalizedVehicle): ScrapedComparable[] {
  const payloads = extractJsonPayloads(html);
  const listings: ScrapedComparable[] = [];
  for (const payload of payloads) collectListings(payload, vehicle, listings);
  return listings.slice(0, 12);
}

function buildTrueCarUrl(vehicle: NormalizedVehicle) {
  const make = slug(vehicle.make);
  const model = slug(vehicle.model);
  const zip = vehicle.zip ? `?searchRadius=75&zip=${encodeURIComponent(vehicle.zip)}` : '';
  return `https://www.truecar.com/used-cars-for-sale/listings/${make}/${model}/${zip}`;
}

function extractJsonPayloads(html: string): unknown[] {
  const payloads: unknown[] = [];
  const next = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (next) try { payloads.push(JSON.parse(next)); } catch {}
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { payloads.push(JSON.parse(match[1])); } catch {}
  }
  return payloads;
}

function collectListings(node: unknown, vehicle: NormalizedVehicle, out: ScrapedComparable[]) {
  if (!node || out.length >= 12) return;
  if (Array.isArray(node)) { for (const item of node) collectListings(item, vehicle, out); return; }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const url = string(obj.url) ?? string(obj.vehicleUrl) ?? string(obj.href) ?? string(obj.link);
  const price = number(obj.price) ?? number(obj.listPrice) ?? number(obj.amount) ?? number((obj.offers as Record<string, unknown> | undefined)?.price);
  const title = string(obj.title) ?? string(obj.name) ?? [obj.year, obj.make, obj.model, obj.trim].filter(Boolean).join(' ');
  if (url && price && /truecar\.com|^\//.test(url)) {
    const listing = normalizeListing({
      source: 'truecar', sourceUrl: url, title, price,
      year: number(obj.year) ?? number(obj.modelYear), make: string(obj.make), model: string(obj.model), trim: string(obj.trim),
      mileage: number(obj.mileage) ?? number(obj.odometer), location: string(obj.location) ?? string(obj.dealerCity), rawPayload: obj
    }, vehicle);
    if (listing && !out.some((x) => x.sourceUrl === listing.sourceUrl)) out.push(listing);
  }
  for (const value of Object.values(obj)) collectListings(value, vehicle, out);
}

const slug = (value?: string) => value?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? '';
const string = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const number = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) || undefined : undefined;
