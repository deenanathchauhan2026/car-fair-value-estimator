import type { ListingInput, ValuationResponse } from './types';
export type ExtensionMessage = { type:'EXTRACT_LISTING' } | { type:'LISTING_EXTRACTED'; listing: ListingInput | null; error?: string } | { type:'REQUEST_VALUATION'; listing: ListingInput } | { type:'VALUATION_RESULT'; result: ValuationResponse } | { type:'VALUATION_ERROR'; error: string };
