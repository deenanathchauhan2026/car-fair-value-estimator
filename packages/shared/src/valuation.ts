import type { ListingInput } from './listing';
export interface ComparableListing extends ListingInput { id?: string; distanceMiles?: number; similarityScore?: number; listedAt?: string; }
export interface ValuationResult { id: string; listingId: string; fairValueLow: number; fairValueHigh: number; fairValueMedian: number; confidenceScore: number; comparableCount: number; comparables: ComparableListing[]; metadata: Record<string, unknown>; createdAt: string; }
export interface ValuationRequest { listing: ListingInput; }
export interface ValuationResponse { listing: ListingInput & { id: string }; valuation: ValuationResult; marketPosition: 'below' | 'at' | 'above' | 'unknown'; }
