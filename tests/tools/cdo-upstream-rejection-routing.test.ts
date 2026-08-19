/**
 * @fileoverview Tests that a CDO rejection reaches the caller with its own
 * explanation intact, routed to the declared reason that matches the cause.
 *
 * Only rejections CDO can actually produce for the input given are injected. A
 * request the tool built from validated input carries a datasetId from the
 * gated set, ISO dates inside the local span cap, and a limit within 1–1000, so
 * the parameter faults CDO documents are unreachable from here: what a real
 * client hits is a rejected API token (HTTP 400, JSON) and an over-long request
 * URL (HTTP 414, Apache's error page).
 *
 * The token rejection is not one tool's problem. Every CDO route sends the same
 * `token` header, so a deployment configured with a bad one fails identically
 * on all eight — which is why the routing is asserted across the whole set from
 * one table rather than per tool, and why every tool that can emit
 * `upstream_auth_failed` must declare it under the same code.
 *
 * @module tests/tools/cdo-upstream-rejection-routing.test
 */

import { JsonRpcErrorCode, McpError } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noaaClimateFetchData } from '@/mcp-server/tools/definitions/noaa-climate-fetch-data.tool.js';
import { noaaClimateFindLocations } from '@/mcp-server/tools/definitions/noaa-climate-find-locations.tool.js';
import { noaaClimateFindStations } from '@/mcp-server/tools/definitions/noaa-climate-find-stations.tool.js';
import { noaaClimateGetStation } from '@/mcp-server/tools/definitions/noaa-climate-get-station.tool.js';
import { noaaClimateListDataCategories } from '@/mcp-server/tools/definitions/noaa-climate-list-data-categories.tool.js';
import { noaaClimateListDataTypes } from '@/mcp-server/tools/definitions/noaa-climate-list-data-types.tool.js';
import { noaaClimateListDatasets } from '@/mcp-server/tools/definitions/noaa-climate-list-datasets.tool.js';
import { noaaClimateListLocationCategories } from '@/mcp-server/tools/definitions/noaa-climate-list-location-categories.tool.js';

vi.mock('@/services/cdo/cdo-service.js', () => ({
  getCdoService: vi.fn(),
}));

import { getCdoService } from '@/services/cdo/cdo-service.js';

/** CDO's verbatim answer to a request carrying a token it does not accept. */
const TOKEN_REJECTION = 'The token parameter provided is not valid.';

/** A rejection shaped as CdoService throws it once the body has been read. */
function cdoRejection(upstreamMessage: string, path: string): McpError {
  return new McpError(
    JsonRpcErrorCode.InvalidParams,
    `NOAA CDO rejected the request to /${path} (HTTP 400): ${upstreamMessage}`,
    { status: 400, path, upstreamMessage },
  );
}

/**
 * A failure whose body explained nothing, shaped as CdoService throws it.
 *
 * 414 maps to `InvalidRequest`, so it never reaches the `InvalidParams`
 * routing — the service's hint is the only recovery the caller gets.
 */
function cdoUnexplainedFailure(status: number, path: string): McpError {
  return new McpError(
    JsonRpcErrorCode.InvalidRequest,
    `NOAA CDO returned HTTP ${status} for /${path}.`,
    {
      status,
      path,
      recovery: {
        hint: 'NOAA CDO gave no explanation for this status. If the request carried long stationId, locationId, or datatypeId arrays, send fewer values.',
      },
    },
  );
}

/** Stand the one CdoService method a tool calls up as a rejection. */
function mockCdoRejection(method: string, error: McpError): void {
  vi.mocked(getCdoService).mockReturnValue({
    [method]: vi.fn().mockRejectedValue(error),
  } as unknown as ReturnType<typeof getCdoService>);
}

async function captureFailure(run: () => unknown): Promise<McpError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof McpError) return error;
    throw error;
  }
  throw new Error('Expected the handler to throw.');
}

/** A request the schema and the local span cap both accept. */
const VALID_INPUT = {
  datasetId: 'GHCND',
  startDate: '2023-01-01',
  endDate: '2023-01-31',
};

/** A datatypeId array long enough to push the request URL past what CDO accepts. */
const OVERSIZED_DATATYPE_FILTER = Array.from({ length: 1_200 }, (_, index) => `DTYPE${index}`);

const fetchDataFailure = (input: Record<string, unknown> = VALID_INPUT) => {
  const ctx = createMockContext({ errors: noaaClimateFetchData.errors });
  return captureFailure(() =>
    noaaClimateFetchData.handler(noaaClimateFetchData.input.parse(input), ctx),
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('noaaClimateFetchData — a rejected API token', () => {
  beforeEach(() => {
    mockCdoRejection('fetchData', cdoRejection(TOKEN_REJECTION, 'data'));
  });

  it('routes to its own reason rather than input validation', async () => {
    // Nothing about the caller's input caused this, and validation_error's
    // recovery sends the agent off to re-verify IDs that were never wrong.
    expect((await fetchDataFailure()).data?.reason).toBe('upstream_auth_failed');
  });

  it('names the environment variable to check, not the tool inputs', async () => {
    const error = await fetchDataFailure();
    const hint = (error.data?.recovery as { hint?: string } | undefined)?.hint ?? '';

    expect(hint).toContain('NOAA_CDO_TOKEN');
    expect(hint).not.toContain('noaa_climate_list_datasets');
  });

  it('carries CDO’s own sentence so the fault is legible', async () => {
    expect((await fetchDataFailure()).message).toContain(TOKEN_REJECTION);
  });

  it('never surfaces the raw fetch URL to the caller', async () => {
    const error = await fetchDataFailure();

    expect(error.message).not.toContain('Fetch failed for');
    expect(error.message).not.toContain('ncei.noaa.gov');
  });
});

describe('noaaClimateFetchData — an over-long request URL', () => {
  beforeEach(() => {
    mockCdoRejection('fetchData', cdoUnexplainedFailure(414, 'data'));
  });

  it('leaves the status-mapped code alone rather than routing it', async () => {
    // 414 is InvalidRequest, past the InvalidParams branch. Inventing a reason
    // for it would claim a cause the response never established.
    const error = await fetchDataFailure({
      ...VALID_INPUT,
      datatypeId: OVERSIZED_DATATYPE_FILTER,
    });

    expect(error.code).toBe(JsonRpcErrorCode.InvalidRequest);
    expect(error.data?.reason).toBeUndefined();
    expect(error.message).toContain('HTTP 414');
  });

  it('still reaches the caller with a next move and without the URL', async () => {
    const error = await fetchDataFailure({
      ...VALID_INPUT,
      datatypeId: OVERSIZED_DATATYPE_FILTER,
    });
    const hint = (error.data?.recovery as { hint?: string } | undefined)?.hint ?? '';

    expect(hint).toMatch(/fewer values/i);
    expect(error.message).not.toContain('ncei.noaa.gov');
  });
});

describe('noaaClimateFetchData — declared reasons', () => {
  it('declares exactly the reasons this tool can emit', () => {
    expect(noaaClimateFetchData.errors?.map((entry) => entry.reason).sort()).toEqual([
      'date_range_exceeded',
      'service_unavailable',
      'upstream_auth_failed',
      'validation_error',
    ]);
  });

  it('reaches date_range_exceeded from the local span cap, with no request made', async () => {
    const fetchData = vi.fn();
    vi.mocked(getCdoService).mockReturnValue({ fetchData } as unknown as ReturnType<
      typeof getCdoService
    >);

    const error = await fetchDataFailure({
      datasetId: 'GHCND',
      startDate: '2020-03-10',
      endDate: '2021-04-01',
    });

    expect(error.data?.reason).toBe('date_range_exceeded');
    expect(error.data?.maxEndDate).toBe('2021-03-31');
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('reaches validation_error from an unknown datasetId, with no request made', async () => {
    const fetchData = vi.fn();
    vi.mocked(getCdoService).mockReturnValue({ fetchData } as unknown as ReturnType<
      typeof getCdoService
    >);

    const error = await fetchDataFailure({ ...VALID_INPUT, datasetId: 'GHCNM' });

    expect(error.data?.reason).toBe('validation_error');
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('reaches upstream_auth_failed from the token rejection', async () => {
    mockCdoRejection('fetchData', cdoRejection(TOKEN_REJECTION, 'data'));

    expect((await fetchDataFailure()).data?.reason).toBe('upstream_auth_failed');
  });
});

describe('noaaClimateFindStations — upstream explanation', () => {
  it('carries CDO’s own sentence into the failure it raises', async () => {
    vi.mocked(getCdoService).mockReturnValue({
      findStations: vi.fn().mockRejectedValue(cdoRejection(TOKEN_REJECTION, 'stations')),
    } as unknown as ReturnType<typeof getCdoService>);
    const ctx = createMockContext({ errors: noaaClimateFindStations.errors });
    const input = noaaClimateFindStations.input.parse({ locationId: 'FIPS:37' });

    const error = await captureFailure(() => noaaClimateFindStations.handler(input, ctx));

    expect(error.message).toContain(TOKEN_REJECTION);
    expect(error.message).not.toContain('Fetch failed for');
    expect(error.message).not.toContain('ncei.noaa.gov');
  });
});

/**
 * CDO's wording when it rejects a parameter the caller actually got wrong.
 *
 * Quoted from the `sortfield` fault, which every list route can raise — the
 * control for the token case: the same HTTP 400, the same XML fault shape, and
 * input that genuinely is at fault, so `validation_error` is the right answer.
 */
const SORTFIELD_REJECTION =
  'sortfield must be one of the following allowed values: id, name, mindate, maxdate, datacoverage';

/**
 * Every CDO-backed tool, with the CdoService method it calls and a call built
 * from input its own schema accepts.
 *
 * `reasons` is the declared union, pinned here so a reason added to a tool
 * without a reachability test fails this file rather than shipping unreachable.
 */
const CDO_TOOLS = [
  {
    label: 'noaa_climate_fetch_data',
    method: 'fetchData',
    errors: noaaClimateFetchData.errors,
    reasons: [
      'date_range_exceeded',
      'service_unavailable',
      'upstream_auth_failed',
      'validation_error',
    ],
    routesInputFaults: true,
    call: () =>
      noaaClimateFetchData.handler(
        noaaClimateFetchData.input.parse(VALID_INPUT),
        createMockContext({ errors: noaaClimateFetchData.errors }),
      ),
  },
  {
    label: 'noaa_climate_find_locations',
    method: 'findLocations',
    errors: noaaClimateFindLocations.errors,
    reasons: [
      'name_filter_category_too_large',
      'name_filter_requires_category',
      'service_unavailable',
      'upstream_auth_failed',
      'validation_error',
    ],
    routesInputFaults: true,
    call: () =>
      noaaClimateFindLocations.handler(
        noaaClimateFindLocations.input.parse({ locationCategoryId: 'ST' }),
        createMockContext({ errors: noaaClimateFindLocations.errors }),
      ),
  },
  {
    label: 'noaa_climate_find_stations',
    method: 'findStations',
    errors: noaaClimateFindStations.errors,
    reasons: ['service_unavailable', 'upstream_auth_failed', 'validation_error'],
    routesInputFaults: true,
    call: () =>
      noaaClimateFindStations.handler(
        noaaClimateFindStations.input.parse({ locationId: 'FIPS:37' }),
        createMockContext({ errors: noaaClimateFindStations.errors }),
      ),
  },
  {
    label: 'noaa_climate_get_station',
    method: 'getStation',
    errors: noaaClimateGetStation.errors,
    reasons: ['not_found', 'service_unavailable', 'upstream_auth_failed'],
    // Declares no validation_error: CDO answers an unknown station ID with
    // HTTP 200 and a bare `{}`, so this route has no input-fault contract to
    // route a 400 onto. Everything but the token rejection passes through.
    routesInputFaults: false,
    call: () =>
      noaaClimateGetStation.handler(
        noaaClimateGetStation.input.parse({ stationId: 'GHCND:USW00024233' }),
        createMockContext({ errors: noaaClimateGetStation.errors }),
      ),
  },
  {
    label: 'noaa_climate_list_data_categories',
    method: 'listDataCategories',
    errors: noaaClimateListDataCategories.errors,
    reasons: ['service_unavailable', 'upstream_auth_failed', 'validation_error'],
    routesInputFaults: true,
    call: () =>
      noaaClimateListDataCategories.handler(
        noaaClimateListDataCategories.input.parse({}),
        createMockContext({ errors: noaaClimateListDataCategories.errors }),
      ),
  },
  {
    label: 'noaa_climate_list_data_types',
    method: 'listDataTypes',
    errors: noaaClimateListDataTypes.errors,
    reasons: ['service_unavailable', 'upstream_auth_failed', 'validation_error'],
    routesInputFaults: true,
    call: () =>
      noaaClimateListDataTypes.handler(
        noaaClimateListDataTypes.input.parse({ datasetId: 'GHCND' }),
        createMockContext({ errors: noaaClimateListDataTypes.errors }),
      ),
  },
  {
    label: 'noaa_climate_list_datasets',
    method: 'listDatasets',
    errors: noaaClimateListDatasets.errors,
    reasons: ['service_unavailable', 'upstream_auth_failed', 'validation_error'],
    routesInputFaults: true,
    call: () =>
      noaaClimateListDatasets.handler(
        noaaClimateListDatasets.input.parse({}),
        createMockContext({ errors: noaaClimateListDatasets.errors }),
      ),
  },
  {
    label: 'noaa_climate_list_location_categories',
    method: 'listLocationCategories',
    errors: noaaClimateListLocationCategories.errors,
    reasons: ['service_unavailable', 'upstream_auth_failed', 'validation_error'],
    routesInputFaults: true,
    call: () =>
      noaaClimateListLocationCategories.handler(
        noaaClimateListLocationCategories.input.parse({}),
        createMockContext({ errors: noaaClimateListLocationCategories.errors }),
      ),
  },
] as const;

describe.each(CDO_TOOLS)('$label — a rejected API token', ({ method, call }) => {
  beforeEach(() => {
    mockCdoRejection(method, cdoRejection(TOKEN_REJECTION, 'any'));
  });

  it('routes to upstream_auth_failed rather than input validation', async () => {
    expect((await captureFailure(call)).data?.reason).toBe('upstream_auth_failed');
  });

  it('names the environment variable to check, not the tool inputs', async () => {
    const error = await captureFailure(call);
    const hint = (error.data?.recovery as { hint?: string } | undefined)?.hint ?? '';

    expect(hint).toContain('NOAA_CDO_TOKEN');
    expect(hint).toMatch(/not at fault|not the problem|nothing.*input/i);
    expect(hint).not.toMatch(/noaa_climate_(list|find)_/);
  });

  it('carries CDO’s own sentence without the request URL', async () => {
    const error = await captureFailure(call);

    expect(error.message).toContain(TOKEN_REJECTION);
    expect(error.message).not.toContain('ncei.noaa.gov');
  });
});

describe.each(CDO_TOOLS)('$label — declared contract', ({ errors, reasons }) => {
  it('declares exactly the reasons this tool can emit', () => {
    expect(errors?.map((entry) => entry.reason).sort()).toEqual([...reasons].sort());
  });

  it('declares upstream_auth_failed as a ConfigurationError', () => {
    // One reason, one code across all eight, so a client can branch on the
    // single value instead of per-tool special-casing.
    const entry = errors?.find((candidate) => candidate.reason === 'upstream_auth_failed');

    expect(entry?.code).toBe(JsonRpcErrorCode.ConfigurationError);
  });
});

describe.each(CDO_TOOLS.filter((entry) => entry.routesInputFaults))(
  '$label — a genuine input fault',
  ({ method, call }) => {
    it('still routes to validation_error', async () => {
      mockCdoRejection(method, cdoRejection(SORTFIELD_REJECTION, 'any'));

      expect((await captureFailure(call)).data?.reason).toBe('validation_error');
    });
  },
);

describe('noaaClimateGetStation — a rejection that is not the token', () => {
  it('passes through unrouted, since the tool declares no input-fault reason', async () => {
    mockCdoRejection('getStation', cdoRejection(SORTFIELD_REJECTION, 'stations/X'));
    const target = CDO_TOOLS.find((entry) => entry.label === 'noaa_climate_get_station');

    const error = await captureFailure(() => target?.call());

    expect(error.code).toBe(JsonRpcErrorCode.InvalidParams);
    expect(error.data?.reason).toBeUndefined();
  });
});
