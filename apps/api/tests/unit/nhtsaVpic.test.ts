import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'nhtsa-vpic-test-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.sqlite');
  process.env.NHTSA_VPIC_CACHE_TTL_HOURS = '720';
  vi.resetModules();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js');
  closeDb();
  vi.unstubAllGlobals();
  delete process.env.DATABASE_PATH;
  delete process.env.NHTSA_VPIC_CACHE_TTL_HOURS;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('NhtsaVpicClient', () => {
  it('skips network calls for invalid VINs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { NhtsaVpicClient } = await import('../../src/api/nhtsaVpic.js');
    const client = new NhtsaVpicClient();

    await expect(client.decodeVin('bad')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps valid VPIC fields into normalized decode output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ Results: [
      { Variable: 'Model Year', Value: '2003' },
      { Variable: 'Make', Value: 'HONDA' },
      { Variable: 'Model', Value: 'Accord' },
      { Variable: 'Trim', Value: 'EX' },
      { Variable: 'Body Class', Value: 'Sedan/Saloon' },
      { Variable: 'Displacement (L)', Value: '3.0' },
      { Variable: 'Engine Number of Cylinders', Value: '6' },
      { Variable: 'Fuel Type - Primary', Value: 'Gasoline' },
      { Variable: 'Drive Type', Value: 'FWD/Front-Wheel Drive' }
    ] }), { status: 200 })));
    const { NhtsaVpicClient } = await import('../../src/api/nhtsaVpic.js');

    await expect(new NhtsaVpicClient().decodeVin('1HGCM82633A004352')).resolves.toMatchObject({
      year: 2003,
      make: 'HONDA',
      model: 'Accord',
      trim: 'EX',
      bodyClass: 'Sedan/Saloon',
      engine: '3L 6 cyl',
      fuelType: 'Gasoline',
      driveType: 'FWD/Front-Wheel Drive'
    });
  });

  it('uses cache to prevent repeat network calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Results: [
      { Variable: 'Model Year', Value: '2003' },
      { Variable: 'Make', Value: 'HONDA' },
      { Variable: 'Model', Value: 'Accord' }
    ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { NhtsaVpicClient } = await import('../../src/api/nhtsaVpic.js');
    const client = new NhtsaVpicClient();

    await client.decodeVin('1HGCM82633A004352');
    await client.decodeVin('1HGCM82633A004352');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    const { NhtsaVpicClient } = await import('../../src/api/nhtsaVpic.js');

    await expect(new NhtsaVpicClient().decodeVin('1HGCM82633A004352')).resolves.toBeUndefined();
  });
});
