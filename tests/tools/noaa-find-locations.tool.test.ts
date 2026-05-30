/**
 * @fileoverview Tests for the noaa_find_locations tool.
 * @module tests/tools/noaa-find-locations.tool.test
 */

import { createMockContext, getEnrichment } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaFindLocations } from '@/mcp-server/tools/definitions/noaa-find-locations.tool.js';

vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

const mockLocations = [
  {
    id: 'FIPS:37',
    name: 'North Carolina',
    datacoverage: 1,
    mindate: '1869-03-01',
    maxdate: '2024-12-31',
  },
  { id: 'FIPS:53', name: 'Washington' }, // sparse
];

beforeEach(() => {
  vi.mocked(getCdoService).mockReturnValue({
    findLocations: vi.fn().mockResolvedValue({
      results: mockLocations,
      metadata: { resultset: { count: 2, limit: 25, offset: 0 } },
    }),
  } as unknown as ReturnType<typeof getCdoService>);
});

describe('noaaFindLocations', () => {
  it('returns location results', async () => {
    const ctx = createMockContext();
    const input = noaaFindLocations.input.parse({ locationCategoryId: 'ST' });
    const result = await noaaFindLocations.handler(input, ctx);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({ id: 'FIPS:37', name: 'North Carolina' });
    expect(getEnrichment(ctx)).toMatchObject({ totalCount: 2 });
    expect(getEnrichment(ctx)).not.toHaveProperty('notice');
  });

  it('enriches with notice when no locations matched', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      findLocations: vi.fn().mockResolvedValue({
        results: [],
        metadata: { resultset: { count: 0, limit: 25, offset: 0 } },
      }),
    } as unknown as ReturnType<typeof getCdoService>);
    const ctx = createMockContext();
    const input = noaaFindLocations.input.parse({ locationCategoryId: 'ZIP' });
    await noaaFindLocations.handler(input, ctx);

    const enrichment = getEnrichment(ctx);
    expect(enrichment.totalCount).toBe(0);
    expect(typeof enrichment.notice).toBe('string');
    expect(enrichment.notice as string).toContain('No locations matched');
  });

  it('passes categoryId and pagination params to service', async () => {
    const mockService = {
      findLocations: vi.fn().mockResolvedValue({
        results: [],
        metadata: { resultset: { count: 0, limit: 10, offset: 50 } },
      }),
    } as unknown as ReturnType<typeof getCdoService>;
    vi.mocked(getCdoService).mockReturnValue(mockService);

    const ctx = createMockContext();
    const input = noaaFindLocations.input.parse({
      locationCategoryId: 'CITY',
      limit: 10,
      offset: 50,
    });
    await noaaFindLocations.handler(input, ctx);

    expect(mockService.findLocations).toHaveBeenCalledWith(
      expect.objectContaining({ locationcategoryid: 'CITY', limit: 10, offset: 50 }),
      ctx,
    );
  });

  it('preserves sparse upstream payloads — omits optional fields', async () => {
    const ctx = createMockContext();
    const input = noaaFindLocations.input.parse({});
    const result = await noaaFindLocations.handler(input, ctx);

    const wa = result.results.find((l) => l.id === 'FIPS:53');
    expect(wa!.datacoverage).toBeUndefined();
    expect(wa!.mindate).toBeUndefined();
  });

  it('formats output with IDs and names', () => {
    const blocks = noaaFindLocations.format!({
      results: mockLocations,
      metadata: { resultset: { count: 2, limit: 25, offset: 0 } },
    });
    const text = blocks[0].text;
    expect(text).toContain('FIPS:37');
    expect(text).toContain('North Carolina');
    expect(text).toContain('0'); // offset
  });
});
