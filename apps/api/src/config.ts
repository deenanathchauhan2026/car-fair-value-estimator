import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function findWorkspaceRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  host: process.env.API_HOST ?? '0.0.0.0',
  databasePath: process.env.DATABASE_PATH ?? join(findWorkspaceRoot(), 'car-value.sqlite'),
  nhtsaVpic: {
    cacheTtlHours: Number(process.env.NHTSA_VPIC_CACHE_TTL_HOURS ?? 720)
  }
};
