import type { Platform } from './platforms';
export interface ListingInput { platform: Platform; sourceUrl: string; title?: string; priceUsd?: number; year?: number; make?: string; model?: string; trim?: string; mileage?: number; vin?: string; location?: string; condition?: string; sellerType?: string; rawJson?: unknown; }
export interface Listing extends ListingInput { id: string; createdAt: string; }
