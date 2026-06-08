/**
 * @fileoverview Extended tests for noaa_get_station — not_found error contract,
 * input validation, and security.
 * @module tests/tools/noaa-get-station-extended.tool.test
 */

import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaGetStation } from '@/mcp-server/tools/definitions/noaa-get-station.tool.js';

vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

const mockStation = {
  id: 'GHCND:USC00450974',
  name: 'YAKIMA WA US',
  latitude: 46.6039,
  longitude: -120.5097,
  elevation: 324.6,
  elevationUnit: 'Meters',
  mindate: '1948-01-01',
  maxdate: '2024-12-31',
  datacoverage: 0.99,
};

beforeEach(() => {
  vi.mocked(getCdoService).mockReturnValue({
    getStation: vi.fn().mockResolvedValue(mockStation),
  } as unknown as ReturnType<typeof getCdoService>);
});

describe('noaaGetStation — input validation', () => {
  it('rejects an empty stationId string', () => {
    expect(() => noaaGetStation.input.parse({ stationId: '' })).toThrow();
  });

  it('accepts a COOP-prefixed station ID', () => {
    const input = noaaGetStation.input.parse({ stationId: 'COOP:010008' });
    expect(input.stationId).toBe('COOP:010008');
  });

  it('accepts a GHCND-prefixed station ID', () => {
    const input = noaaGetStation.input.parse({ stationId: 'GHCND:USC00450974' });
    expect(input.stationId).toBe('GHCND:USC00450974');
  });
});

describe('noaaGetStation — not_found error contract', () => {
  it('throws not_found when API returns an object with no id', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({ name: 'Unknown' }),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const input = noaaGetStation.input.parse({ stationId: 'GHCND:BADID' });
    await expect(noaaGetStation.handler(input, ctx)).rejects.toMatchObject({
      data: { reason: 'not_found' },
    });
  });

  it('throws not_found when API returns an empty object', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const input = noaaGetStation.input.parse({ stationId: 'GHCND:NONE' });
    await expect(noaaGetStation.handler(input, ctx)).rejects.toMatchObject({
      data: { reason: 'not_found' },
    });
  });

  it('not_found error message includes the queried station ID', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const stationId = 'GHCND:NOTEXIST999';
    const input = noaaGetStation.input.parse({ stationId });
    await expect(noaaGetStation.handler(input, ctx)).rejects.toMatchObject({
      message: expect.stringContaining(stationId),
    });
  });

  it('not_found error carries a recovery hint pointing to noaa_find_stations', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const input = noaaGetStation.input.parse({ stationId: 'GHCND:ZZZZZZZZZZ' });
    await expect(noaaGetStation.handler(input, ctx)).rejects.toMatchObject({
      data: {
        reason: 'not_found',
        recovery: { hint: expect.stringContaining('noaa_find_stations') },
      },
    });
  });
});

describe('noaaGetStation — output shape', () => {
  it('output includes elevationUnit when present', async () => {
    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const input = noaaGetStation.input.parse({ stationId: 'GHCND:USC00450974' });
    const result = await noaaGetStation.handler(input, ctx);
    expect(result.elevationUnit).toBe('Meters');
  });

  it('output omits elevationUnit when absent upstream', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({ id: 'GHCND:X', name: 'X Station', elevation: 100 }),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const input = noaaGetStation.input.parse({ stationId: 'GHCND:X' });
    const result = await noaaGetStation.handler(input, ctx);
    expect(result.elevation).toBe(100);
    expect(result.elevationUnit).toBeUndefined();
  });

  it('output includes mindate and maxdate when present', async () => {
    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const input = noaaGetStation.input.parse({ stationId: 'GHCND:USC00450974' });
    const result = await noaaGetStation.handler(input, ctx);
    expect(result.mindate).toBe('1948-01-01');
    expect(result.maxdate).toBe('2024-12-31');
  });
});

describe('noaaGetStation — security', () => {
  it('injection attempt in stationId is forwarded as-is to the service', async () => {
    const mockService = {
      getStation: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext({ errors: noaaGetStation.errors });
    const injection = 'GHCND:X/../../../etc/passwd';
    const input = noaaGetStation.input.parse({ stationId: injection });

    // Expect a not_found since the mock returns {} — no path traversal on the server side
    await expect(noaaGetStation.handler(input, ctx)).rejects.toMatchObject({
      data: { reason: 'not_found' },
    });
    expect(mockService.getStation).toHaveBeenCalledWith(injection, ctx);
  });
});
