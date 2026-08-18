/**
 * @fileoverview The date-range cap must mirror the boundary NOAA CDO actually
 * enforces, not a day count that approximates it.
 *
 * CDO's rule, established by probing the live `/data` endpoint: a request is
 * accepted while `endDate` falls on or before the last day of the calendar
 * month N years after `startDate`'s month — N = 1 for daily and radar datasets,
 * 10 for monthly and annual ones. Past that CDO answers HTTP 400 with "The date
 * range must be less than 1 year." Every accept/reject pair below was verified
 * live. NEXRAD2 and NEXRAD3 carry the cap even though CDO documents it only for
 * the daily datasets: their accepted rows fall through to an unrelated HTTP 500,
 * while the rejected ones answer with the range error.
 *
 * The day count that boundary allows therefore varies with the start date
 * (365 through 397 for the daily cap), which is why a fixed 365-day cap
 * rejected a full leap year that CDO answers with 366 records.
 * @module tests/tools/fetch-data-date-range.test
 */

import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaClimateFetchData } from '@/mcp-server/tools/definitions/noaa-climate-fetch-data.tool.js';

vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

beforeEach(() => {
  vi.mocked(getCdoService).mockReturnValue({
    fetchData: vi.fn().mockResolvedValue({
      results: [],
      metadata: { resultset: { count: 0, limit: 25, offset: 1 } },
    }),
  } as unknown as ReturnType<typeof getCdoService>);
});

/** Ranges CDO answers with data — the server must forward them. */
const ACCEPTED: ReadonlyArray<readonly [string, string, string]> = [
  ['GHCND', '2024-01-01', '2024-12-31'], // full leap year, 366 days
  ['GHCND', '2023-01-01', '2023-12-31'], // full common year, 365 days
  ['GHCND', '2024-01-01', '2025-01-31'], // last accepted end for a January start
  ['GHCND', '2024-06-15', '2025-06-30'],
  ['GHCND', '2022-03-10', '2023-03-31'],
  ['GHCND', '2023-12-31', '2024-12-31'], // year rollover
  ['GHCND', '2024-02-29', '2025-02-28'], // leap day start, non-leap landing month
  ['PRECIP_15', '2024-01-01', '2024-12-31'],
  ['NORMAL_DLY', '2010-01-01', '2010-12-31'],
  ['GSOM', '2010-01-01', '2019-12-31'], // full 10 calendar years, 3652 days
  ['GSOM', '2010-01-01', '2020-01-31'],
  ['GSOM', '2010-03-15', '2020-03-31'],
  ['GSOY', '2000-01-01', '2010-01-31'],
  // Radar carries the same 1-year cap CDO documents for daily datasets.
  ['NEXRAD2', '2020-03-10', '2021-03-31'],
  ['NEXRAD3', '2020-03-10', '2021-03-31'],
  ['NEXRAD2', '2020-01-01', '2021-01-31'],
];

/** Ranges CDO rejects with HTTP 400 — the server must reject them first. */
const REJECTED: ReadonlyArray<readonly [string, string, string]> = [
  ['GHCND', '2024-01-01', '2025-02-01'],
  ['GHCND', '2024-06-15', '2025-07-01'],
  ['GHCND', '2022-03-10', '2023-04-01'],
  ['GHCND', '2023-12-31', '2025-01-01'],
  ['GHCND', '2024-02-29', '2025-03-01'],
  ['GHCND', '2020-01-01', '2021-12-31'],
  ['GSOM', '2010-01-01', '2020-02-01'],
  ['GSOM', '2010-03-15', '2020-04-01'],
  ['GSOY', '2000-01-01', '2010-02-01'],
  ['NEXRAD2', '2020-03-10', '2021-04-01'],
  ['NEXRAD3', '2020-03-10', '2021-04-01'],
  ['NEXRAD2', '2020-01-01', '2021-02-01'],
];

describe('noaaClimateFetchData — CDO date-range boundary', () => {
  it.each(ACCEPTED)('accepts %s %s..%s', async (datasetId, startDate, endDate) => {
    const ctx = createMockContext({ errors: noaaClimateFetchData.errors });
    const input = noaaClimateFetchData.input.parse({ datasetId, startDate, endDate });

    const result = await noaaClimateFetchData.handler(input, ctx);

    expect(result.results).toEqual([]);
    expect(vi.mocked(getCdoService)().fetchData).toHaveBeenCalled();
  });

  it.each(REJECTED)('rejects %s %s..%s', async (datasetId, startDate, endDate) => {
    const ctx = createMockContext({ errors: noaaClimateFetchData.errors });
    const input = noaaClimateFetchData.input.parse({ datasetId, startDate, endDate });

    await expect(noaaClimateFetchData.handler(input, ctx)).rejects.toMatchObject({
      data: { reason: 'date_range_exceeded' },
    });
    expect(vi.mocked(getCdoService)().fetchData).not.toHaveBeenCalled();
  });

  it('names the last acceptable end date so the caller can split the request', async () => {
    const ctx = createMockContext({ errors: noaaClimateFetchData.errors });
    const input = noaaClimateFetchData.input.parse({
      datasetId: 'GHCND',
      startDate: '2024-06-15',
      endDate: '2025-07-01',
    });

    const err = (await Promise.resolve(noaaClimateFetchData.handler(input, ctx)).catch(
      (e: unknown) => e,
    )) as {
      message: string;
      data: { maxEndDate: string; requestedDays: number; maxDays: number };
    };

    expect(err.data.maxEndDate).toBe('2025-06-30');
    expect(err.data.requestedDays).toBe(382);
    expect(err.data.maxDays).toBe(381);
    expect(err.message).toContain('2025-06-30');
  });

  it('applies the same boundary to the compact and unpadded date forms', async () => {
    const ctx = createMockContext({ errors: noaaClimateFetchData.errors });

    const compact = noaaClimateFetchData.input.parse({
      datasetId: 'GHCND',
      startDate: '20240101',
      endDate: '20241231',
    });
    await expect(noaaClimateFetchData.handler(compact, ctx)).resolves.toBeDefined();

    const unpadded = noaaClimateFetchData.input.parse({
      datasetId: 'GHCND',
      startDate: '2024-1-1',
      endDate: '2025-2-1',
    });
    await expect(noaaClimateFetchData.handler(unpadded, ctx)).rejects.toMatchObject({
      data: { reason: 'date_range_exceeded' },
    });
  });

  it.each(['NEXRAD2', 'NEXRAD3'])(
    'caps %s at the same boundary rather than forwarding an over-long range',
    async (datasetId) => {
      const ctx = createMockContext({ errors: noaaClimateFetchData.errors });
      const input = noaaClimateFetchData.input.parse({
        datasetId,
        startDate: '2000-01-01',
        endDate: '2024-12-31',
      });

      await expect(noaaClimateFetchData.handler(input, ctx)).rejects.toMatchObject({
        data: { reason: 'date_range_exceeded', maxEndDate: '2001-01-31' },
      });
      expect(vi.mocked(getCdoService)().fetchData).not.toHaveBeenCalled();
    },
  );

  it('names the 10-year limit with the same hyphenation as the 1-year arm', async () => {
    const ctx = createMockContext({ errors: noaaClimateFetchData.errors });
    const input = noaaClimateFetchData.input.parse({
      datasetId: 'GSOM',
      startDate: '2000-01-01',
      endDate: '2020-01-01',
    });

    const err = (await Promise.resolve(noaaClimateFetchData.handler(input, ctx)).catch(
      (e: unknown) => e,
    )) as { message: string };

    expect(err.message).toContain('the 10-year limit');
    expect(err.message).not.toContain('10 years limit');
  });
});
