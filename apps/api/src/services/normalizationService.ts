import type { ListingInput } from '@car-value/shared';
export class NormalizationService { normalize(input: ListingInput): ListingInput { return { ...input, make: clean(input.make), model: clean(input.model), trim: clean(input.trim), title: input.title?.trim(), vin: input.vin?.toUpperCase().replace(/[^A-Z0-9]/g,''), mileage: input.mileage == null ? undefined : Math.round(input.mileage), priceUsd: input.priceUsd == null ? undefined : Math.round(input.priceUsd) }; } }
const clean = (v?: string) => v?.trim().replace(/\s+/g,' ');
export const normalizationService = new NormalizationService();
