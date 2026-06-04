/**
 * @fileoverview Extended tests for noaa_list_datasets — params forwarding,
 * input validation, and security.
 * @module tests/tools/noaa-list-datasets-extended.tool.test
 */

import { JsonRpcErrorCode, McpError } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaListDatasets } from '@/mcp-server/tools/definitions/noaa-list-datasets.tool.js';

vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

const mockResponse = {
  results: [
    {
      id: 'GHCND',
      name: 'Daily Summaries',
      datacoverage: 1,
      mindate: '1763-01-01',
      maxdate: '2024-12-31',
    },
  ],
  metadata: { resultset: { count: 1, limit: 25, offset: 0 } },
};

beforeEach(() => {
  vi.mocked(getCdoService).mockReturnValue({
    listDatasets: vi.fn().mockResolvedValue(mockResponse),
  } as unknown as ReturnType<typeof getCdoService>);
});

describe('noaaListDatasets — input validation', () => {
  it('rejects limit=0', () => {
    expect(() => noaaListDatasets.input.parse({ limit: 0 })).toThrow();
  });

  it('rejects limit=1001', () => {
    expect(() => noaaListDatasets.input.parse({ limit: 1001 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => noaaListDatasets.input.parse({ offset: -1 })).toThrow();
  });

  it('rejects invalid sortField', () => {
    expect(() => noaaListDatasets.input.parse({ sortField: 'foo' })).toThrow();
  });

  it('accepts valid sortField values', () => {
    for (const field of ['id', 'name', 'mindate', 'maxdate', 'datacoverage'] as const) {
      const input = noaaListDatasets.input.parse({ sortField: field });
      expect(input.sortField).toBe(field);
    }
  });
});

describe('noaaListDatasets — service params forwarding', () => {
  it('forwards stationId and startDate/endDate filters', async () => {
    const mockService = {
      listDatasets: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    const input = noaaListDatasets.input.parse({
      stationId: 'GHCND:USC00450974',
      startDate: '2010-01-01',
      endDate: '2020-12-31',
    });
    await noaaListDatasets.handler(input, ctx);

    expect(mockService.listDatasets).toHaveBeenCalledWith(
      expect.objectContaining({
        stationid: 'GHCND:USC00450974',
        startdate: '2010-01-01',
        enddate: '2020-12-31',
      }),
      ctx,
    );
  });

  it('forwards sort params', async () => {
    const mockService = {
      listDatasets: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    const input = noaaListDatasets.input.parse({ sortField: 'name', sortOrder: 'desc' });
    await noaaListDatasets.handler(input, ctx);

    expect(mockService.listDatasets).toHaveBeenCalledWith(
      expect.objectContaining({ sortfield: 'name', sortorder: 'desc' }),
      ctx,
    );
  });
});

describe('noaaListDatasets — error propagation', () => {
  it('propagates service errors without swallowing', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      listDatasets: vi.fn().mockRejectedValue(new Error('CDO API unavailable')),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    const input = noaaListDatasets.input.parse({});
    await expect(noaaListDatasets.handler(input, ctx)).rejects.toThrow();
  });

  it('re-throws service HTTP 400 as validation_error with data.reason set', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      listDatasets: vi.fn().mockRejectedValue(
        new McpError(JsonRpcErrorCode.InvalidParams, 'NOAA CDO returned HTTP 400.', {
          status: 400,
        }),
      ),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaListDatasets.errors });
    const input = noaaListDatasets.input.parse({ locationId: 'INVALID:99' });
    await expect(noaaListDatasets.handler(input, ctx)).rejects.toMatchObject({
      data: { reason: 'validation_error' },
    });
  });

  it('passes non-InvalidParams McpErrors through unchanged', async () => {
    const serviceError = new McpError(
      JsonRpcErrorCode.ServiceUnavailable,
      'NOAA CDO returned HTTP 503.',
      { status: 503 },
    );
    vi.mocked(getCdoService).mockReturnValue({
      listDatasets: vi.fn().mockRejectedValue(serviceError),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaListDatasets.errors });
    const input = noaaListDatasets.input.parse({});
    await expect(noaaListDatasets.handler(input, ctx)).rejects.toBe(serviceError);
  });
});

describe('noaaListDatasets — security', () => {
  it('injection attempts in locationId are forwarded as opaque strings', async () => {
    const mockService = {
      listDatasets: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    const injection = "FIPS:37' OR '1'='1";
    const input = noaaListDatasets.input.parse({ locationId: injection });
    await noaaListDatasets.handler(input, ctx);

    expect(mockService.listDatasets).toHaveBeenCalledWith(
      expect.objectContaining({ locationid: injection }),
      ctx,
    );
  });

  it('unicode in datatypeId is forwarded without modification', async () => {
    const mockService = {
      listDatasets: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    const unicodeId = 'TMAX​'; // zero-width space
    const input = noaaListDatasets.input.parse({ datatypeId: [unicodeId] });
    await noaaListDatasets.handler(input, ctx);

    expect(mockService.listDatasets).toHaveBeenCalledWith(
      expect.objectContaining({ datatypeid: [unicodeId] }),
      ctx,
    );
  });
});
