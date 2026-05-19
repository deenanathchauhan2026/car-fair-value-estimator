import { valuationRequestSchema } from '../schemas/valuationSchemas.js';
import { valuationService } from '../services/valuationService.js';
export async function valuationRoutes(app) { app.post('/api/valuations', async (request, reply) => { const parsed = valuationRequestSchema.safeParse(request.body); if (!parsed.success)
    return reply.code(400).send({ error: 'Invalid valuation request', issues: parsed.error.flatten() }); return valuationService.value(parsed.data.listing); }); }
