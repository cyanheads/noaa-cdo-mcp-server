/**
 * @fileoverview Extended tests for noaa_list_data_categories — params forwarding,
 * input validation, and error propagation.
 * @module tests/tools/noaa-list-data-categories-extended.tool.test
 */

import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaListDataCategories } from '@/mcp-server/tools/definitions/noaa-list-data-categories.tool.js';

vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

const mockResponse = {
  results: [
    { id: 'TEMP', name: 'Air Temperature' },
    { id: 'PRCP', name: 'Precipitation' },
  ],
  metadata: { resultset: { count: 2, limit: 25, offset: 0 } },
};

beforeEach(() => {
  vi.mocked(getCdoService).mockReturnValue({
    listDataCategories: vi.fn().mockResolvedValue(mockResponse),
  } as unknown as ReturnType<typeof getCdoService>);
});

describe('noaaListDataCategories — input validation', () => {
  it('rejects limit=0', () => {
    expect(() => noaaListDataCategories.input.parse({ limit: 0 })).toThrow();
  });

  it('rejects limit=1001', () => {
    expect(() => noaaListDataCategories.input.parse({ limit: 1001 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => noaaListDataCategories.input.parse({ offset: -1 })).toThrow();
  });

  it('rejects invalid sortField', () => {
    expect(() => noaaListDataCategories.input.parse({ sortField: 'coverage' })).toThrow();
  });

  it('accepts sortField=id and sortField=name', () => {
    expect(noaaListDataCategories.input.parse({ sortField: 'id' }).sortField).toBe('id');
    expect(noaaListDataCategories.input.parse({ sortField: 'name' }).sortField).toBe('name');
  });
});

describe('noaaListDataCategories — all filter params forwarded', () => {
  it('forwards datasetId, locationId, stationId, date range, sort, and pagination', async () => {
    const mockService = {
      listDataCategories: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    const input = noaaListDataCategories.input.parse({
      datasetId: 'GHCND',
      locationId: 'FIPS:37',
      stationId: 'GHCND:USC00450974',
      startDate: '2020-01-01',
      endDate: '2023-12-31',
      sortField: 'name',
      sortOrder: 'asc',
      limit: 10,
      offset: 5,
    });
    await noaaListDataCategories.handler(input, ctx);

    expect(mockService.listDataCategories).toHaveBeenCalledWith(
      expect.objectContaining({
        datasetid: 'GHCND',
        locationid: 'FIPS:37',
        stationid: 'GHCND:USC00450974',
        startdate: '2020-01-01',
        enddate: '2023-12-31',
        sortfield: 'name',
        sortorder: 'asc',
        limit: 10,
        offset: 5,
      }),
      ctx,
    );
  });
});

describe('noaaListDataCategories — error propagation', () => {
  it('propagates service errors', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      listDataCategories: vi.fn().mockRejectedValue(new Error('CDO unavailable')),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    const input = noaaListDataCategories.input.parse({});
    await expect(noaaListDataCategories.handler(input, ctx)).rejects.toThrow();
  });
});
