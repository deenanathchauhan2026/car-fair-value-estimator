import { getDb } from '../db.js';

type ValuationInput = {
  listingId: string;
  fairValueLow: number;
  fairValueHigh: number;
  fairValueMedian: number;
  confidenceScore: number;
  comparableCount: number;
  comparables: unknown;
  metadata: unknown;
};

type ValuationRow = Omit<ValuationInput, 'comparables' | 'metadata'> & {
  id: string;
  comparables: string;
  metadata: string;
  createdAt: string;
};

function toStoredValuation(row: ValuationRow) {
  return {
    ...row,
    comparables: JSON.parse(row.comparables),
    metadata: JSON.parse(row.metadata)
  };
}

export class ValuationRepository {
  async create(data: ValuationInput) {
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

    return toStoredValuation(db.prepare('SELECT * FROM valuations WHERE id = ?').get(id) as ValuationRow);
  }
}

export const valuationRepository = new ValuationRepository();
