import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
describe('valuation route', () => { it('returns valuation response', async () => { const app = await buildApp(); const res = await app.inject({ method:'POST', url:'/api/valuations', payload:{ listing:{ platform:'generic', sourceUrl:'https://example.com/listing', year:2020, make:'Toyota', model:'Camry', priceUsd:21000 } } }); expect(res.statusCode).toBe(200); expect(res.json().valuation.fairValueMedian).toBeGreaterThan(0); await app.close(); }); });
