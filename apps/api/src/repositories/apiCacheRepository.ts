import { getDb } from '../db.js';

export class ApiCacheRepository {
  getCached<T>(provider: string, cacheKey: string): T | null {
    try {
      const row = getDb()
        .prepare(
          `SELECT response_json FROM api_response_cache
           WHERE provider = @provider AND cache_key = @cacheKey AND expires_at > datetime('now')`
        )
        .get({ provider, cacheKey }) as { response_json: string } | undefined;
      return row ? (JSON.parse(row.response_json) as T) : null;
    } catch {
      return null;
    }
  }

  setCached(provider: string, cacheKey: string, payload: unknown, ttlHours: number): void {
    try {
      getDb()
        .prepare(
          `INSERT INTO api_response_cache (provider, cache_key, response_json, expires_at, created_at)
           VALUES (@provider, @cacheKey, @responseJson, datetime('now', @ttl), datetime('now'))
           ON CONFLICT(provider, cache_key) DO UPDATE SET
             response_json = excluded.response_json,
             expires_at = excluded.expires_at,
             created_at = datetime('now')`
        )
        .run({ provider, cacheKey, responseJson: JSON.stringify(payload), ttl: `+${Math.max(1, ttlHours)} hours` });
    } catch {}
  }

  getMonthlyUsage(provider: string, period = currentPeriod()): number {
    try {
      const row = getDb()
        .prepare('SELECT count FROM api_usage WHERE provider = @provider AND period = @period')
        .get({ provider, period }) as { count: number } | undefined;
      return row?.count ?? 0;
    } catch {
      return 0;
    }
  }

  incrementMonthlyUsage(provider: string, period = currentPeriod()): void {
    try {
      getDb()
        .prepare(
          `INSERT INTO api_usage (provider, period, count, updated_at)
           VALUES (@provider, @period, 1, datetime('now'))
           ON CONFLICT(provider, period) DO UPDATE SET
             count = count + 1,
             updated_at = datetime('now')`
        )
        .run({ provider, period });
    } catch {}
  }

  canCallProvider(provider: string, monthlyLimit: number): boolean {
    return this.getMonthlyUsage(provider) < monthlyLimit;
  }
}

function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const apiCacheRepository = new ApiCacheRepository();
