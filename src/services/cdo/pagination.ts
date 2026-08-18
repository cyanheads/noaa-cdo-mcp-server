/**
 * @fileoverview Pagination semantics for NOAA CDO collection responses —
 * telling an exhausted page apart from a genuine no-match result.
 * @module services/cdo/pagination
 */

import type { Context } from '@cyanheads/mcp-ts-core';
import type { CdoCollectionResponse, CdoListParams } from './types.js';

/**
 * Outcome of resolving a collection response's true match total.
 *
 * `exhausted` distinguishes "this page is past the end of a non-empty result
 * set" from "nothing matched", which the raw CDO response cannot express.
 */
export type CollectionTotal = {
  /** Total matches before the page limit. */
  totalCount: number;
  /** True when the requested offset sits past the end of a non-empty result set. */
  exhausted: boolean;
};

/**
 * Resolve the true match total for a CDO collection response.
 *
 * CDO answers an offset past the final page with a bare `{}` — no `results` key
 * and no `metadata` — byte-identical to its genuine no-match reply. When that
 * happens at a nonzero offset, re-request the first page with the same filters
 * to recover the total. At most one extra request is made, and only for that
 * exact case: a response at offset 0 needs no probe, because a bare `{}` there
 * is already an authentic zero-match result.
 *
 * The probe overrides only pagination and metadata controls; every domain
 * filter is reused verbatim so the count describes the same query.
 */
export async function resolveCollectionTotal<T>(
  response: CdoCollectionResponse<T>,
  params: CdoListParams,
  ctx: Context,
  fetchPage: (probeParams: CdoListParams, ctx: Context) => Promise<CdoCollectionResponse<T>>,
): Promise<CollectionTotal> {
  const count = response.metadata?.resultset.count;
  if (count !== undefined) return { totalCount: count, exhausted: false };

  const resultCount = response.results?.length ?? 0;
  if (resultCount > 0) return { totalCount: resultCount, exhausted: false };

  if (!params.offset) return { totalCount: 0, exhausted: false };

  ctx.log.debug('Empty metadata-less page at a nonzero offset — probing first page', {
    offset: params.offset,
  });
  const probe = await fetchPage({ ...params, offset: 0, limit: 1, includemetadata: true }, ctx);
  const probeTotal = probe.metadata?.resultset.count ?? probe.results?.length ?? 0;
  return { totalCount: probeTotal, exhausted: probeTotal > 0 };
}
