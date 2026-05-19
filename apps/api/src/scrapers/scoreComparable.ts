import type { ComparableListing } from '@car-value/shared';
import type { NormalizedVehicle } from './normalizeListing.js';
import { isBadTitle } from './normalizeListing.js';

export function scoreComparable(vehicle: NormalizedVehicle, comp: ComparableListing): number {
  let score = 0;
  if (vehicle.year && comp.year) score += comp.year === vehicle.year ? 35 : Math.max(0, 18 - Math.abs(comp.year - vehicle.year) * 6);
  if (same(vehicle.make, comp.make)) score += 20;
  if (same(vehicle.model, comp.model) || includes(comp.title, vehicle.model)) score += 24;
  if (vehicle.trim && (same(vehicle.trim, comp.trim) || includes(comp.title, vehicle.trim))) score += 8;
  if (vehicle.mileage && comp.mileage) {
    const delta = Math.abs(comp.mileage - vehicle.mileage) / Math.max(vehicle.mileage, 1);
    score += Math.max(0, 13 - delta * 30);
  }
  return Math.min(100, Math.round(score));
}

export function rankAndFilterComparables(vehicle: NormalizedVehicle, comps: ComparableListing[], limit = 8): ComparableListing[] {
  const byUrl = new Map<string, ComparableListing>();
  const prices = comps.map((c) => c.priceUsd).filter((p): p is number => typeof p === 'number' && p > 0).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : undefined;

  for (const comp of comps) {
    if (!comp.sourceUrl || !comp.priceUsd || isBadTitle(comp.title)) continue;
    if (median && (comp.priceUsd < median * 0.45 || comp.priceUsd > median * 1.9)) continue;
    const score = scoreComparable(vehicle, comp);
    if (score < 35) continue;
    const existing = byUrl.get(comp.sourceUrl);
    if (!existing || (existing.similarityScore ?? 0) < score / 100) byUrl.set(comp.sourceUrl, { ...comp, similarityScore: score / 100 });
  }

  return [...byUrl.values()]
    .sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0))
    .slice(0, limit);
}

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase().trim() === b.toLowerCase().trim();
const includes = (text?: string, needle?: string) => !!text && !!needle && text.toLowerCase().includes(needle.toLowerCase());
