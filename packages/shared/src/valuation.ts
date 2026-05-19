import type { ListingInput } from './listing';
export interface ComparableListing extends ListingInput { id?: string; distanceMiles?: number; similarityScore?: number; listedAt?: string; }
export type ConfidenceTier = 'high' | 'medium' | 'low-medium' | 'low';
export interface ValuationResult { id: string; listingId: string; fairValueLow: number; fairValueHigh: number; fairValueMedian: number; confidenceScore: number; confidenceTier?: ConfidenceTier; comparableCount: number; comparables: ComparableListing[]; metadata: Record<string, unknown>; estimateSource?: string; createdAt: string; }
export interface ValuationRequest { listing: ListingInput; }
export interface ValuationResponse { listing: ListingInput & { id: string }; valuation: ValuationResult; marketPosition: 'below' | 'at' | 'above' | 'unknown'; estimateSource?: string; }
