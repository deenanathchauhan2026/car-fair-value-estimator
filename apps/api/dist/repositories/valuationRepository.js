import { getDb } from '../db.js';
function toStoredValuation(row) {
    return {
        ...row,
        comparables: JSON.parse(row.comparables),
        metadata: JSON.parse(row.metadata)
    };
}
export class ValuationRepository {
    async create(data) {
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const db = getDb();
        db.prepare(`
      INSERT INTO valuations (
        id, listingId, fairValueLow, fairValueHigh, fairValueMedian,
        confidenceScore, comparableCount, comparables, metadata, createdAt
      ) VALUES (
        @id, @listingId, @fairValueLow, @fairValueHigh, @fairValueMedian,
        @confidenceScore, @comparableCount, @comparables, @metadata, @createdAt
      )
    `).run({
            id,
            ...data,
            comparables: JSON.stringify(data.comparables),
            metadata: JSON.stringify(data.metadata),
            createdAt
        });
        return toStoredValuation(db.prepare('SELECT * FROM valuations WHERE id = ?').get(id));
    }
}
export const valuationRepository = new ValuationRepository();
