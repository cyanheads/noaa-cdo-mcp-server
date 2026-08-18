/**
 * @fileoverview Tests for the noaa_climate_list_data_categories tool.
 * @module tests/tools/noaa-climate-list-data-categories.tool.test
 */

import { createMockContext, getEnrichment } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaClimateListDataCategories } from '@/mcp-server/tools/definitions/noaa-climate-list-data-categories.tool.js';
import { firstText } from '../helpers/content.js';

vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

const mockCategories = [
  { id: 'TEMP', name: 'Air Temperature' },
  { id: 'PRCP', name: 'Precipitation' },
];

beforeEach(() => {
  vi.mocked(getCdoService).mockReturnValue({
    listDataCategories: vi.fn().mockResolvedValue({
      results: mockCategories,
      metadata: { resultset: { count: 2, limit: 25, offset: 0 } },
    }),
  } as unknown as ReturnType<typeof getCdoService>);
});

describe('noaaClimateListDataCategories', () => {
  it('returns category results', async () => {
    const ctx = createMockContext({ errors: noaaClimateListDataCategories.errors });
    const input = noaaClimateListDataCategories.input.parse({});
    const result = await noaaClimateListDataCategories.handler(input, ctx);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({ id: 'TEMP', name: 'Air Temperature' });
    expect(getEnrichment(ctx)).toMatchObject({ totalCount: 2 });
    expect(getEnrichment(ctx)).not.toHaveProperty('notice');
  });

  it('returns empty array gracefully when API returns no results', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      listDataCategories: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof getCdoService>);

    const ctx = createMockContext({ errors: noaaClimateListDataCategories.errors });
    const input = noaaClimateListDataCategories.input.parse({});
    const result = await noaaClimateListDataCategories.handler(input, ctx);

    expect(result.results).toEqual([]);
    const enrichment = getEnrichment(ctx);
    expect(enrichment.totalCount).toBe(0);
    expect(typeof enrichment.notice).toBe('string');
    expect(enrichment.notice as string).toContain('No data categories matched');
  });

  it('formats output listing category IDs and names', () => {
    const blocks = noaaClimateListDataCategories.format!({
      results: mockCategories,
      metadata: { resultset: { count: 2, limit: 25, offset: 0 } },
    });
    expect(blocks[0]?.type).toBe('text');
    const text = firstText(blocks);
    expect(text).toContain('TEMP');
    expect(text).toContain('Air Temperature');
    expect(text).toContain('PRCP');
    expect(text).toContain('Precipitation');
    expect(text).toContain('0'); // offset
  });

  it('formats empty results with a neutral empty-page message', () => {
    const blocks = noaaClimateListDataCategories.format!({
      results: [],
      metadata: { resultset: { count: 0, limit: 25, offset: 0 } },
    });
    expect(firstText(blocks)).toContain('No records on this page.');
  });
});
