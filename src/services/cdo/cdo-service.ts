/**
 * @fileoverview NOAA CDO API v2 client. Handles all HTTP requests, parameter
 * translation (camelCase → CDO lowercase), retry logic, and response parsing.
 * @module services/cdo/cdo-service
 */

import type { Context } from '@cyanheads/mcp-ts-core';
import { fetchWithTimeout, requestContextService, withRetry } from '@cyanheads/mcp-ts-core/utils';
import { getServerConfig } from '@/config/server-config.js';
import type {
  CdoCollectionResponse,
  CdoDataCategory,
  CdoDataRecord,
  CdoDataset,
  CdoDataType,
  CdoListParams,
  CdoLocation,
  CdoStation,
} from './types.js';

const BASE_URL = 'https://www.ncei.noaa.gov/cdo-web/api/v2';
const REQUEST_TIMEOUT_MS = 15_000;

/** Serialize a value that may be an array to repeated query param entries. */
function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | string[] | number | boolean | undefined,
): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const v of value) {
      if (v) params.append(key, v);
    }
  } else {
    params.append(key, String(value));
  }
}

/** Build URLSearchParams from CdoListParams, translating camelCase → CDO lowercase keys. */
function buildParams(p: CdoListParams): URLSearchParams {
  const q = new URLSearchParams();
  appendParam(q, 'datasetid', p.datasetid);
  appendParam(q, 'datacategoryid', p.datacategoryid);
  appendParam(q, 'locationid', p.locationid);
  appendParam(q, 'stationid', p.stationid);
  appendParam(q, 'datatypeid', p.datatypeid);
  appendParam(q, 'locationcategoryid', p.locationcategoryid);
  appendParam(q, 'startdate', p.startdate);
  appendParam(q, 'enddate', p.enddate);
  appendParam(q, 'sortfield', p.sortfield);
  appendParam(q, 'sortorder', p.sortorder);
  appendParam(q, 'extent', p.extent);
  appendParam(q, 'units', p.units);
  if (p.limit !== undefined) appendParam(q, 'limit', p.limit);
  // NOAA CDO API uses 1-based offset; convert 0-based client input (+1).
  if (p.offset !== undefined) appendParam(q, 'offset', p.offset + 1);
  if (p.includemetadata !== undefined) appendParam(q, 'includemetadata', p.includemetadata);
  return q;
}

export class CdoService {
  private readonly baseUrl: string;

  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make a single authenticated GET request to the CDO API, with retry.
   *
   * `expectedStatuses` lists non-2xx statuses that are an ordinary outcome for
   * the endpoint rather than a fault — they log at `debug` instead of `error`.
   * The status-mapped `McpError` is thrown either way. No CDO route needs it
   * today; it stays for an endpoint that maps a status to an ordinary result.
   */
  private get<T>(
    path: string,
    params: CdoListParams,
    ctx: Context,
    expectedStatuses?: number[],
  ): Promise<T> {
    const { token } = getServerConfig();
    const retryCtx = requestContextService.createRequestContext({
      operation: `cdo.${path}`,
      parentContext: {
        requestId: ctx.requestId,
        tenantId: ctx.tenantId,
        ...(ctx.auth ? { auth: ctx.auth } : {}),
      },
    });

    return withRetry(
      async () => {
        const qs = buildParams(params).toString();
        const url = `${this.baseUrl}/${path}${qs ? `?${qs}` : ''}`;
        ctx.log.debug('CDO API request', { url });

        const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, retryCtx, {
          headers: { token },
          signal: ctx.signal,
          ...(expectedStatuses ? { expectedStatuses } : {}),
        });

        const text = await response.text();
        if (/^\s*<(!DOCTYPE\s+html|html[\s>])/i.test(text)) {
          const { serviceUnavailable } = await import('@cyanheads/mcp-ts-core/errors');
          throw serviceUnavailable(
            'NOAA CDO returned HTML instead of JSON — likely rate-limited.',
            { path },
          );
        }

        return JSON.parse(text) as T;
      },
      {
        operation: `cdo.${path}`,
        context: retryCtx,
        baseDelayMs: 1000,
        signal: ctx.signal,
      },
    );
  }

  /** Fetch datasets, optionally filtered. */
  listDatasets(params: CdoListParams, ctx: Context): Promise<CdoCollectionResponse<CdoDataset>> {
    return this.get<CdoCollectionResponse<CdoDataset>>('datasets', params, ctx);
  }

  /** Fetch data categories, optionally filtered. */
  listDataCategories(
    params: CdoListParams,
    ctx: Context,
  ): Promise<CdoCollectionResponse<CdoDataCategory>> {
    return this.get<CdoCollectionResponse<CdoDataCategory>>('datacategories', params, ctx);
  }

  /** Fetch data types, optionally filtered. */
  listDataTypes(params: CdoListParams, ctx: Context): Promise<CdoCollectionResponse<CdoDataType>> {
    return this.get<CdoCollectionResponse<CdoDataType>>('datatypes', params, ctx);
  }

  /** Fetch locations, optionally filtered. */
  findLocations(params: CdoListParams, ctx: Context): Promise<CdoCollectionResponse<CdoLocation>> {
    return this.get<CdoCollectionResponse<CdoLocation>>('locations', params, ctx);
  }

  /** Fetch stations, optionally filtered. */
  findStations(params: CdoListParams, ctx: Context): Promise<CdoCollectionResponse<CdoStation>> {
    return this.get<CdoCollectionResponse<CdoStation>>('stations', params, ctx);
  }

  /**
   * Fetch a single station by ID.
   *
   * CDO answers an unknown ID with HTTP 200 and a bare `{}`, never a 404, so
   * this route declares no expected non-2xx statuses. The not-found path is the
   * callers' `!station.id` check.
   */
  getStation(stationId: string, ctx: Context): Promise<CdoStation> {
    return this.get<CdoStation>(`stations/${encodeURIComponent(stationId)}`, {}, ctx);
  }

  /** Fetch observation data. */
  fetchData(params: CdoListParams, ctx: Context): Promise<CdoCollectionResponse<CdoDataRecord>> {
    return this.get<CdoCollectionResponse<CdoDataRecord>>('data', params, ctx);
  }
}

// --- Init/accessor pattern ---

let _service: CdoService | undefined;

export function initCdoService(): void {
  _service = new CdoService();
}

export function getCdoService(): CdoService {
  if (!_service) {
    throw new Error('CdoService not initialized — call initCdoService() in setup()');
  }
  return _service;
}
