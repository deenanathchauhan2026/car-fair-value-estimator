import type { ComparableListing, ListingInput } from '@car-value/shared';
import { listingRepository } from '../repositories/listingRepository.js';
const seed: ComparableListing[] = [
 {platform:'generic',sourceUrl:'https://example.com/camry1',year:2020,make:'Toyota',model:'Camry',trim:'SE',mileage:41000,priceUsd:21400,location:'NJ',distanceMiles:22},
 {platform:'generic',sourceUrl:'https://example.com/camry2',year:2020,make:'Toyota',model:'Camry',trim:'LE',mileage:52000,priceUsd:19900,location:'NY',distanceMiles:48},
 {platform:'generic',sourceUrl:'https://example.com/accord1',year:2019,make:'Honda',model:'Accord',trim:'EX',mileage:61000,priceUsd:20500,location:'PA',distanceMiles:80}
];
export class ComparableService {
  async find(listing: ListingInput): Promise<ComparableListing[]> {
    let db: ComparableListing[] = [];
    try {
      db = (await listingRepository.findComparables(listing)).map(x => ({
        id: x.id,
        platform: x.platform as ComparableListing['platform'],
        sourceUrl: x.sourceUrl,
        title: x.title ?? undefined,
        priceUsd: x.priceUsd ?? undefined,
        year: x.year ?? undefined,
        make: x.make ?? undefined,
        model: x.model ?? undefined,
        trim: x.trim ?? undefined,
        mileage: x.mileage ?? undefined,
        vin: x.vin ?? undefined,
        location: x.location ?? undefined,
        condition: x.condition ?? undefined,
        sellerType: x.sellerType ?? undefined,
        rawJson: x.rawJson ?? undefined
      }));
    } catch { db = []; }
    const local = seed.filter(c => same(c.make, listing.make) && same(c.model, listing.model) && (!listing.year || !c.year || Math.abs(c.year-listing.year)<=1));
    return [...db, ...local].slice(0, 12);
  }
}
const same = (a?: string,b?: string) => !!a && !!b && a.toLowerCase()===b.toLowerCase();
export const comparableService = new ComparableService();
