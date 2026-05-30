/**
 * @fileoverview Tests for the noaa://stations/{stationId} resource.
 * @module tests/resources/noaa-station.resource.test
 */

import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaStationResource } from '@/mcp-server/resources/definitions/noaa-station.resource.js';

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

describe('noaaStationResource', () => {
  it('returns full station metadata for a known station', async () => {
    const ctx = createMockContext();
    const result = await noaaStationResource.handler({ stationId: 'GHCND:USC00450974' }, ctx);

    expect(result).toMatchObject({
      id: 'GHCND:USC00450974',
      name: 'YAKIMA WA US',
      latitude: 46.6039,
      elevation: 324.6,
    });
  });

  it('throws not_found when service returns an object without an id', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({ name: 'Unknown' }),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    await expect(
      noaaStationResource.handler({ stationId: 'GHCND:BADID' }, ctx),
    ).rejects.toMatchObject({ message: expect.stringContaining('not found') });
  });

  it('throws not_found (not undefined) when API returns empty object', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    await expect(noaaStationResource.handler({ stationId: 'GHCND:NONE' }, ctx)).rejects.toThrow();
  });

  it('propagates service errors', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockRejectedValue(new Error('NOAA CDO returned HTTP 429')),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    await expect(
      noaaStationResource.handler({ stationId: 'GHCND:USC00450974' }, ctx),
    ).rejects.toThrow();
  });

  it('preserves sparse upstream payloads — omits optional fields when absent', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({ id: 'GHCND:SPARSE', name: 'Sparse Station' }),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    const result = await noaaStationResource.handler({ stationId: 'GHCND:SPARSE' }, ctx);

    expect((result as { id: string }).id).toBe('GHCND:SPARSE');
    expect((result as Record<string, unknown>).latitude).toBeUndefined();
    expect((result as Record<string, unknown>).elevation).toBeUndefined();
    expect((result as Record<string, unknown>).datacoverage).toBeUndefined();
  });

  it('error message includes the station ID for actionable diagnosis', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      getStation: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    const stationId = 'GHCND:NOTFOUND123';
    await expect(noaaStationResource.handler({ stationId }, ctx)).rejects.toMatchObject({
      message: expect.stringContaining(stationId),
    });
  });

  it('passes the stationId directly to the service without modification', async () => {
    const mockService = {
      getStation: vi.fn().mockResolvedValue(mockStation),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    await noaaStationResource.handler({ stationId: 'GHCND:USC00450974' }, ctx);

    expect(mockService.getStation).toHaveBeenCalledWith('GHCND:USC00450974', ctx);
  });
});
