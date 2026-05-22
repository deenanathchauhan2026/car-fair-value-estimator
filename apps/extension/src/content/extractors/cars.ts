import type { ListingInput } from '@car-value/shared';
import { parseLocation } from '../dom/location';
import { parseMileage } from '../dom/mileage';
import { parsePrice } from '../dom/price';
import { visibleText } from '../dom/text';
import { parseVin } from '../dom/vin';
import { extractYearMakeModel } from './generic';

type JsonObject = Record<string, unknown>;

export function extractCarsCom(doc: Document = document, url = location.href): ListingInput {
  const json = vehicleJson(doc);
  const text = visibleText(doc);
  const title = stringValue(json?.name) || doc.querySelector('h1, [data-testid="vehicle-title"]')?.textContent?.trim() || doc.title;
  const ymm = extractYearMakeModel(`${title} ${text}`);
  const offers = objectValue(json?.offers);
  const brand = objectValue(json?.brand) ?? objectValue(json?.manufacturer);

  return {
    platform: 'cars_com',
    sourceUrl: url,
    title,
    priceUsd: numberValue(offers?.price) ?? parsePrice(text),
    year: numberValue(json?.vehicleModelDate) ?? ymm.year,
    make: stringValue(brand?.name) ?? ymm.make,
    model: stringValue(json?.model) ?? ymm.model,
    trim: stringValue(json?.vehicleConfiguration) ?? trimFromText(text),
    mileage: numberValue(objectValue(json?.mileageFromOdometer)?.value) ?? parseMileage(text),
    vin: stringValue(json?.vehicleIdentificationNumber)?.toUpperCase() ?? parseVin(text),
    location: parseLocation(text) ?? doc.querySelector('[data-testid*="seller-address"], .seller-address')?.textContent?.trim(),
    sellerType: sellerTypeFromText(text),
    condition: stringValue(json?.itemCondition) ?? conditionFromText(text),
    rawJson: json ?? { extractedBy: 'cars_com' }
  };
}

function vehicleJson(doc: Document): JsonObject | undefined {
  return Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap((script) => parseJsonLd(script.textContent || ''))
    .find((item) => /Vehicle|Car/i.test(String(item['@type'] ?? '')));
}

function parseJsonLd(text: string): JsonObject[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isObject);
    if (isObject(parsed)) {
      const graph = parsed['@graph'];
      return [parsed, ...(Array.isArray(graph) ? graph.filter(isObject) : [])];
    }
  } catch {}
  return [];
}

function sellerTypeFromText(text: string): string | undefined {
  if (/private seller|owner/i.test(text)) return 'private';
  if (/dealer|dealership/i.test(text)) return 'dealer';
  return undefined;
}

function conditionFromText(text: string): string | undefined {
  return text.match(/condition\s*:?\s*([^\n]+)/i)?.[1]?.trim();
}

function trimFromText(text: string): string | undefined {
  return text.match(/trim\s*:?\s*([^\n]+)/i)?.[1]?.trim();
}

function objectValue(value: unknown): JsonObject | undefined { return isObject(value) ? value : undefined; }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}
function isObject(value: unknown): value is JsonObject { return typeof value === 'object' && value !== null; }
