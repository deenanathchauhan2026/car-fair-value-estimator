export async function healthRoutes(app) { app.get('/health', async () => ({ ok: true, service: 'car-value-api' })); }
