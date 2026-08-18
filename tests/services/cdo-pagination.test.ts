/**
 * @fileoverview Tests for resolveCollectionTotal — the bounded first-page probe
 * that separates an exhausted page from a genuine no-match result.
 * @module tests/services/cdo-pagination.test
 */

import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { describe, expect, it, vi } from 'vitest';
import { resolveCollectionTotal } from '@/services/cdo/pagination.js';
import type { CdoListParams } from '@/services/cdo/types.js';

const FILTERS: CdoListParams = {
  locationcategoryid: 'ST',
  datasetid: 'GHCND',
  startdate: '2024-07-01',
  enddate: '2024-07-07',
  sortfield: 'name',
  limit: 5,
  offset: 55,
};

/** The bare `{}` CDO returns for an exhausted page and for a true no-match. */
const BARE = {};

describe('resolveCollectionTotal — no probe needed', () => {
  it('trusts upstream metadata when present', async () => {
    const ctx = createMockContext();
    const probe = vi.fn();

    const result = await resolveCollectionTotal(
      { results: [{ id: 'a' }], metadata: { resultset: { count: 51, limit: 5, offset: 1 } } },
      FILTERS,
      ctx,
      probe,
    );

    expect(result).toEqual({ totalCount: 51, exhausted: false });
    expect(probe).not.toHaveBeenCalled();
  });

  it('treats an explicit upstream count of 0 as authoritative', async () => {
    const ctx = createMockContext();
    const probe = vi.fn();

    const result = await resolveCollectionTotal(
      { results: [], metadata: { resultset: { count: 0, limit: 5, offset: 1 } } },
      FILTERS,
      ctx,
      probe,
    );

    expect(result).toEqual({ totalCount: 0, exhausted: false });
    expect(probe).not.toHaveBeenCalled();
  });

  it('falls back to the page length when results arrive without metadata', async () => {
    const ctx = createMockContext();
    const probe = vi.fn();

    const result = await resolveCollectionTotal(
      { results: [{ id: 'a' }, { id: 'b' }] },
      FILTERS,
      ctx,
      probe,
    );

    expect(result).toEqual({ totalCount: 2, exhausted: false });
    expect(probe).not.toHaveBeenCalled();
  });

  it('does not probe a bare response at offset 0 — it is already authentic', async () => {
    const ctx = createMockContext();
    const probe = vi.fn();

    const result = await resolveCollectionTotal(BARE, { ...FILTERS, offset: 0 }, ctx, probe);

    expect(result).toEqual({ totalCount: 0, exhausted: false });
    expect(probe).not.toHaveBeenCalled();
  });

  it('does not probe when offset is absent entirely', async () => {
    const ctx = createMockContext();
    const probe = vi.fn();
    const { offset: _dropped, ...noOffset } = FILTERS;

    const result = await resolveCollectionTotal(BARE, noOffset, ctx, probe);

    expect(result).toEqual({ totalCount: 0, exhausted: false });
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('resolveCollectionTotal — bounded probe', () => {
  it('recovers the true total and flags the page exhausted', async () => {
    const ctx = createMockContext();
    const probe = vi.fn().mockResolvedValue({
      results: [{ id: 'a' }],
      metadata: { resultset: { count: 51, limit: 1, offset: 1 } },
    });

    const result = await resolveCollectionTotal(BARE, FILTERS, ctx, probe);

    expect(result).toEqual({ totalCount: 51, exhausted: true });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('reports a genuine no-match when the first page is also bare', async () => {
    const ctx = createMockContext();
    const probe = vi.fn().mockResolvedValue(BARE);

    const result = await resolveCollectionTotal(BARE, FILTERS, ctx, probe);

    expect(result).toEqual({ totalCount: 0, exhausted: false });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('reuses every domain filter and overrides only pagination and metadata', async () => {
    const ctx = createMockContext();
    const probe = vi
      .fn()
      .mockResolvedValue({ metadata: { resultset: { count: 51, limit: 1, offset: 1 } } });

    await resolveCollectionTotal(BARE, FILTERS, ctx, probe);

    expect(probe).toHaveBeenCalledWith(
      {
        locationcategoryid: 'ST',
        datasetid: 'GHCND',
        startdate: '2024-07-01',
        enddate: '2024-07-07',
        sortfield: 'name',
        limit: 1,
        offset: 0,
        includemetadata: true,
      },
      ctx,
    );
  });

  it('forces metadata on even when the original request disabled it', async () => {
    const ctx = createMockContext();
    const probe = vi
      .fn()
      .mockResolvedValue({ metadata: { resultset: { count: 7, limit: 1, offset: 1 } } });

    await resolveCollectionTotal(BARE, { ...FILTERS, includemetadata: false }, ctx, probe);

    expect(probe.mock.calls[0]![0]).toMatchObject({ includemetadata: true });
  });

  it('falls back to the probe page length when the probe itself omits metadata', async () => {
    const ctx = createMockContext();
    const probe = vi.fn().mockResolvedValue({ results: [{ id: 'a' }] });

    const result = await resolveCollectionTotal(BARE, FILTERS, ctx, probe);

    expect(result).toEqual({ totalCount: 1, exhausted: true });
  });

  it('treats a probe returning an empty results array as a no-match', async () => {
    const ctx = createMockContext();
    const probe = vi.fn().mockResolvedValue({ results: [] });

    const result = await resolveCollectionTotal(BARE, FILTERS, ctx, probe);

    expect(result).toEqual({ totalCount: 0, exhausted: false });
  });

  it('probes at most once, never recursively', async () => {
    const ctx = createMockContext();
    const probe = vi.fn().mockResolvedValue(BARE);

    await resolveCollectionTotal(BARE, { ...FILTERS, offset: 1000 }, ctx, probe);

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('propagates a probe failure rather than masking it as a no-match', async () => {
    const ctx = createMockContext();
    const probe = vi.fn().mockRejectedValue(new Error('NOAA CDO returned HTTP 503'));

    await expect(resolveCollectionTotal(BARE, FILTERS, ctx, probe)).rejects.toThrow('HTTP 503');
  });
});
