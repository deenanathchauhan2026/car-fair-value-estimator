import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { valuationRoutes } from './routes/valuation.js';
import { listingRoutes } from './routes/listings.js';
import { compsRoutes } from './routes/comps.js';
import { vinRoutes } from './routes/vin.js';
export async function buildApp() { const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } }); await app.register(cors, { origin: true }); await app.register(healthRoutes); await app.register(valuationRoutes); await app.register(listingRoutes); await app.register(compsRoutes); await app.register(vinRoutes); return app; }
