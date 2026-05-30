/**
 * @fileoverview Tests for the noaa_list_datasets tool.
 * @module tests/tools/noaa-list-datasets.tool.test
 */

import { createMockContext, getEnrichment } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaListDatasets } from '@/mcp-server/tools/definitions/noaa-list-datasets.tool.js';

// Mock the service module so tests don't hit the network
vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

const mockDatasets = [
  {
    id: 'GHCND',
    name: 'Daily Summaries',
    datacoverage: 1,
    mindate: '1763-01-01',
    maxdate: '2024-12-31',
  },
  {
    id: 'GSOM',
    name: 'Global Summary of the Month',
    datacoverage: 0.95,
    mindate: '1763-01-01',
    maxdate: '2024-12-31',
  },
];

const mockResponse = {
  results: mockDatasets,
  metadata: { resultset: { count: 2, limit: 25, offset: 0 } },
};

beforeEach(() => {
  vi.mocked(getCdoService).mockReturnValue({
    listDatasets: vi.fn().mockResolvedValue(mockResponse),
  } as unknown as ReturnType<typeof getCdoService>);
});

describe('noaaListDatasets', () => {
  it('returns dataset results with metadata', async () => {
    const ctx = createMockContext();
    const input = noaaListDatasets.input.parse({});
    const result = await noaaListDatasets.handler(input, ctx);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      id: 'GHCND',
      name: 'Daily Summaries',
      datacoverage: 1,
    });
    expect(result.metadata?.resultset.count).toBe(2);
    expect(getEnrichment(ctx)).toMatchObject({ totalCount: 2 });
    expect(getEnrichment(ctx)).not.toHaveProperty('notice');
  });

  it('returns empty results gracefully when API returns no data', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      listDatasets: vi
        .fn()
        .mockResolvedValue({ metadata: { resultset: { count: 0, limit: 25, offset: 0 } } }),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext();
    const input = noaaListDatasets.input.parse({});
    const result = await noaaListDatasets.handler(input, ctx);

    expect(result.results).toEqual([]);
    expect(result.metadata?.resultset.count).toBe(0);
    const enrichment = getEnrichment(ctx);
    expect(enrichment.totalCount).toBe(0);
    expect(typeof enrichment.notice).toBe('string');
    expect(enrichment.notice as string).toContain('No datasets matched');
  });

  it('passes filter params to the service', async () => {
    const mockService = {
      listDatasets: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    const input = noaaListDatasets.input.parse({
      datatypeId: ['TMAX'],
      locationId: 'FIPS:37',
      limit: 10,
    });
    await noaaListDatasets.handler(input, ctx);

    expect(mockService.listDatasets).toHaveBeenCalledWith(
      expect.objectContaining({ datatypeid: ['TMAX'], locationid: 'FIPS:37', limit: 10 }),
      ctx,
    );
  });

  it('formats output with dataset IDs, names, coverage, and dates', () => {
    const blocks = noaaListDatasets.format!({
      results: mockDatasets,
      metadata: { resultset: { count: 2, limit: 25, offset: 0 } },
    });
    expect(blocks[0].type).toBe('text');
    const text = blocks[0].text;
    expect(text).toContain('GHCND');
    expect(text).toContain('Daily Summaries');
    expect(text).toContain('1763-01-01');
    expect(text).toContain('2024-12-31');
    expect(text).toContain('100%');
    expect(text).toContain('0'); // offset
  });

  it('formats empty results with a fallback message', () => {
    const blocks = noaaListDatasets.format!({
      results: [],
      metadata: { resultset: { count: 0, limit: 25, offset: 0 } },
    });
    expect(blocks[0].text).toContain('No datasets');
  });
});
