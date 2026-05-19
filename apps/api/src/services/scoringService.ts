import type { ComparableListing, ListingInput } from '@car-value/shared';
import { isLikelyVin } from '../utils/vin.js';
export class ScoringService { score(listing: ListingInput, comps: ComparableListing[]) { let score=0.15; if (isLikelyVin(listing.vin)) score+=0.15; if (listing.trim) score+=0.12; if (listing.year && listing.make && listing.model) score+=0.18; score += Math.min(0.3, comps.length*0.04); if (listing.location) score+=0.05; if (listing.mileage) score+=0.05; return Math.max(0, Math.min(1, Number(score.toFixed(2)))); } }
export const scoringService = new ScoringService();
