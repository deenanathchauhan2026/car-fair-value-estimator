import { z } from 'zod';
import { platforms } from './platforms';
export const listingInputSchema = z.object({ platform: z.enum(platforms), sourceUrl: z.string().url(), title: z.string().optional(), priceUsd: z.number().positive().optional(), year: z.number().int().min(1886).max(new Date().getFullYear() + 1).optional(), make: z.string().optional(), model: z.string().optional(), trim: z.string().optional(), mileage: z.number().nonnegative().optional(), vin: z.string().optional(), location: z.string().optional(), condition: z.string().optional(), sellerType: z.string().optional(), rawJson: z.unknown().optional() });
export const valuationRequestSchema = z.object({ listing: listingInputSchema });
