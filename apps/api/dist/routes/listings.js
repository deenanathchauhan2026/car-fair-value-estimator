import { listingInputSchema } from '../schemas/listingSchemas.js';
import { listingRepository } from '../repositories/listingRepository.js';
export async function listingRoutes(app) { app.post('/api/listings', async (request, reply) => { const parsed = listingInputSchema.safeParse(request.body); if (!parsed.success)
    return reply.code(400).send({ error: 'Invalid listing', issues: parsed.error.flatten() }); return listingRepository.create(parsed.data); }); }
