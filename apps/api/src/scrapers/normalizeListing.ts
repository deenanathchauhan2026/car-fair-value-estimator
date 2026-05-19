import type { ComparableListing, ListingInput } from '@car-value/shared';

export type ScraperSource = 'craigslist' | 'truecar' | 'autolist' | 'marketcheck';
export type NormalizedVehicle = Pick<ListingInput, 'year' | 'make' | 'model' | 'trim' | 'mileage' | 'location'> & { zip?: string; sourceUrl?: string; priceUsd?: number };
export type ScrapedComparable = ComparableListing & { source: ScraperSource; zip?: string };

type RawListing = {
  source: ScraperSource;
  sourceUrl?: string;
  title?: string;
  price?: number | string | null;
  mileage?: number | string | null;
  location?: string;
  year?: number | string | null;
  make?: string;
  model?: string;
  trim?: string;
  rawPayload?: unknown;
};

export function normalizeVehicle(input: ListingInput & { zip?: string }): NormalizedVehicle {
  return {
    year: input.year,
    make: clean(input.make),
    model: clean(input.model),
    trim: clean(input.trim),
    mileage: toNumber(input.mileage),
    location: clean(input.location),
    zip: clean((input as { zip?: string }).zip) ?? extractZip(input.location) ?? extractZip(input.sourceUrl),
    sourceUrl: input.sourceUrl,
    priceUsd: input.priceUsd
  };
}

export function normalizeListing(raw: RawListing, vehicle: NormalizedVehicle): ScrapedComparable | null {
  const title = decodeHtml(clean(raw.title) ?? '').trim();
  const priceUsd = toNumber(raw.price);
  const sourceUrl = absolutize(raw.sourceUrl, raw.source);
  if (!priceUsd || priceUsd < 500 || !sourceUrl || isBadTitle(title)) return null;

  const year = toNumber(raw.year) ?? extractYear(title) ?? vehicle.year;
  const mileage = toNumber(raw.mileage);
  const id = `${raw.source}:${hash(sourceUrl)}`;
  return {
    id,
    platform: raw.source === 'craigslist' ? 'craigslist' : 'generic',
    sourceUrl,
    title: title || [year, raw.make ?? vehicle.make, raw.model ?? vehicle.model, raw.trim ?? vehicle.trim].filter(Boolean).join(' '),
    priceUsd,
    year,
    make: clean(raw.make) ?? vehicle.make,
    model: clean(raw.model) ?? vehicle.model,
    trim: clean(raw.trim) ?? vehicle.trim,
    mileage,
    location: clean(raw.location) ?? vehicle.location,
    rawJson: { source: raw.source, payload: raw.rawPayload },
    source: raw.source,
    zip: vehicle.zip
  };
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().includes('k mi')
    ? value.replace(/[^0-9.]/g, '') + '000'
    : value.replace(/[^0-9.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

export function extractZip(text?: string): string | undefined {
  return text?.match(/\b\d{5}\b/)?.[0];
}

export function extractYear(text?: string): number | undefined {
  const parsed = Number(text?.match(/\b(19\d{2}|20\d{2})\b/)?.[0]);
  const maxYear = new Date().getFullYear() + 1;
  return parsed >= 1980 && parsed <= maxYear ? parsed : undefined;
}

export function isBadTitle(title?: string): boolean {
  const value = title?.toLowerCase() ?? '';
  return /salvage|rebuilt|parts?\s+only|part\s*out|mechanic special|does not run|no title/.test(value);
}

export function clean(value?: string | null): string | undefined {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed || undefined;
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function absolutize(url: string | undefined, source: ScraperSource): string | undefined {
  if (!url) return undefined;
  try { return new URL(url).toString(); } catch {}
  const base = source === 'craigslist' ? 'https://craigslist.org' : source === 'truecar' ? 'https://www.truecar.com' : source === 'autolist' ? 'https://www.autolist.com' : 'https://api.marketcheck.com';
  try { return new URL(url, base).toString(); } catch { return undefined; }
}

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = Math.imul(31, h) + value.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}
