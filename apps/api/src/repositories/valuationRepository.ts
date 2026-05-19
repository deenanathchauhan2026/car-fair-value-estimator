import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class ValuationRepository { async create(data: { listingId: string; fairValueLow: number; fairValueHigh: number; fairValueMedian: number; confidenceScore: number; comparableCount: number; comparables: unknown; metadata: unknown }) { return prisma.valuation.create({ data: { ...data, comparables: data.comparables as object, metadata: data.metadata as object } }); } }
export const valuationRepository = new ValuationRepository();
