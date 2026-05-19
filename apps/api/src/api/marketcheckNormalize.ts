import type { ComparableListing } from '@car-value/shared';
import type { NormalizedVehicle } from '../scrapers/normalizeListing.js';
import { clean, toNumber } from '../scrapers/normalizeListing.js';
import type { MarketCheckListing } from './marketcheckTypes.js';

export function normalizeMarketCheckListing(listing: MarketCheckListing, vehicle: NormalizedVehicle): ComparableListing | null {
  const priceUsd = toNumber(listing.price);
  const sourceUrl = clean(listing.vdp_url);
  if (!priceUsd || !sourceUrl) return null;

  const year = toNumber(listing.year) ?? toNumber(listing.build?.year) ?? vehicle.year;
  const make = clean(listing.make) ?? clean(listing.build?.make) ?? vehicle.make;
  const model = clean(listing.model) ?? clean(listing.build?.model) ?? vehicle.model;
  const trim = clean(listing.trim) ?? clean(listing.build?.trim) ?? vehicle.trim;
  const location = [listing.dealer?.city, listing.dealer?.state].filter(Boolean).join(', ') || vehicle.location;
  const id = listing.id ? `marketcheck:${listing.id}` : `marketcheck:${hash(sourceUrl)}`;

  return {
    id,
    platform: 'generic',
    sourceUrl,
    title: clean(listing.heading) ?? [year, make, model, trim].filter(Boolean).join(' '),
    priceUsd,
    year,
    make,
    model,
    trim,
    mileage: toNumber(listing.miles),
    vin: clean(listing.vin),
    location,
    sellerType: clean(listing.dealer?.seller_type),
    rawJson: { source: 'marketcheck', payload: listing },
    similarityScore: 0.9
  };
}

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
