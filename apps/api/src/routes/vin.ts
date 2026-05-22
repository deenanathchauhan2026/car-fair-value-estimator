import type { FastifyInstance } from 'fastify';
import { nhtsaVpicClient } from '../api/nhtsaVpic.js';
import { isLikelyVin } from '../utils/vin.js';

export async function vinRoutes(app: FastifyInstance) {
  app.get<{ Params: { vin: string } }>('/api/vin/:vin/decode', async (request, reply) => {
    const vin = request.params.vin.trim().toUpperCase();
    if (!isLikelyVin(vin)) return reply.code(400).send({ error: 'Invalid VIN format' });
    const decoded = await nhtsaVpicClient.decodeVin(vin);
    if (!decoded) return reply.code(404).send({ error: 'VIN decode returned no useful vehicle data' });
    return { vin, provider: 'nhtsa-vpic', decoded };
  });
}
