import { z } from 'zod';
import { listingInputSchema } from '../schemas/valuationSchemas.js';
import { compsLookupService } from '../services/compsLookupService.js';
const compsLookupSchema = listingInputSchema.extend({ zip: z.string().optional() });
export async function compsRoutes(app) {
    app.post('/api/comps/lookup', async (request, reply) => {
        const parsed = compsLookupSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'Invalid comps lookup request', issues: parsed.error.flatten() });
        return compsLookupService.lookup(parsed.data);
    });
}
