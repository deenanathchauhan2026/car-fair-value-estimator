import { PrismaClient } from '@prisma/client';
import type { ListingInput } from '@car-value/shared';
const prisma = new PrismaClient();
export class ListingRepository {
  async create(input: ListingInput) { return prisma.listing.create({ data: { ...input, rawJson: input.rawJson as object | undefined } }); }
  async findComparables(input: ListingInput, limit = 25) {
    return prisma.listing.findMany({ where: { make: { equals: input.make, mode: 'insensitive' }, model: { equals: input.model, mode: 'insensitive' }, year: input.year ? { gte: input.year - 1, lte: input.year + 1 } : undefined, priceUsd: { not: null } }, orderBy: { createdAt: 'desc' }, take: limit });
  }
}
export const listingRepository = new ListingRepository();
