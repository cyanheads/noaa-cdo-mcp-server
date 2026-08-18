/**
 * @fileoverview Search for NOAA CDO geographic locations by category.
 * @module mcp-server/tools/definitions/noaa-find-locations
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode, McpError } from '@cyanheads/mcp-ts-core/errors';
import {
  identifierFilter,
  isoDateFilter,
} from '@/mcp-server/tools/definitions/shared/validation.js';
import { getCdoService } from '@/services/cdo/cdo-service.js';
import { resolveCollectionTotal } from '@/services/cdo/pagination.js';

export const noaaClimateFindLocations = tool('noaa_climate_find_locations', {
  title: 'Find NOAA Climate Locations',
  description:
    'Search for geographic locations by category (CITY, ST, CNTY, CNTRY, ZIP, CLIM_REG, etc.). Returns location IDs used in station search and data queries. Without locationCategoryId, returns all location types. Use locationCategoryId=ST to list US states (51 entries — small enough to retrieve completely). Use locationCategoryId=CITY for cities (thousands of entries — use pagination and sortField=name to navigate alphabetically). The CDO API has no name-search parameter; to find a specific city, sort alphabetically with sortField=name and page through results. Location IDs: states as FIPS:37 (NC), cities as CITY:US530031, zip codes as ZIP:98101, countries as CNTRY:US. Obtain location IDs here, then pass them to noaa_climate_find_stations or noaa_climate_fetch_data.',
  annotations: { readOnlyHint: true, openWorldHint: true },
  input: z.object({
    locationCategoryId: identifierFilter(
      'Category filter. Use ST for states (51 entries), CNTY for counties, CITY for cities (large set — thousands of entries), CNTRY for countries, ZIP for zip codes, CLIM_REG for NOAA climate regions, CLIM_DIV for climate divisions, HYD_ACC/HYD_CAT/HYD_REG/HYD_SUB for hydrological categories. Optional — omit to return all location types.',
    ).optional(),
    datasetId: identifierFilter(
      'Filter to locations covered by this dataset (e.g., "GHCND"). Optional.',
    ).optional(),
    datacategoryId: identifierFilter(
      'Filter to locations with this data category (e.g., "TEMP"). Optional.',
    ).optional(),
    startDate: isoDateFilter(
      'Filter to locations with data on or after this ISO date (YYYY-MM-DD). Optional.',
    ).optional(),
    endDate: isoDateFilter(
      'Filter to locations with data on or before this ISO date (YYYY-MM-DD). Optional.',
    ).optional(),
    sortField: z
      .enum(['id', 'name', 'mindate', 'maxdate', 'datacoverage'])
      .optional()
      .describe(
        'Sort results by this field. Use name with sortOrder=asc to browse alphabetically when searching for a specific city or location name. Optional.',
      ),
    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .describe('Sort direction. Optional; defaults to asc.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(25)
      .describe('Maximum number of results to return (1–1000). Defaults to 25.'),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Zero-based index of the first result to return for pagination. Defaults to 0.'),
  }),
  output: z.object({
    results: z
      .array(
        z
          .object({
            id: z.string().describe('Location ID (e.g., FIPS:37, CITY:US530031, ZIP:98101).'),
            name: z.string().describe('Human-readable location name.'),
            datacoverage: z
              .number()
              .optional()
              .describe('Fractional data coverage (0–1). Omitted when not provided by the API.'),
            mindate: z
              .string()
              .optional()
              .describe(
                'Earliest date data is available for this location. Omitted when not provided.',
              ),
            maxdate: z
              .string()
              .optional()
              .describe(
                'Latest date data is available for this location. Omitted when not provided.',
              ),
          })
          .describe('A single location entry.'),
      )
      .describe('Matching locations.'),
    metadata: z
      .object({
        resultset: z
          .object({
            count: z.number().describe('Total number of matching locations.'),
            limit: z.number().describe('Page size used for this response.'),
            offset: z
              .number()
              .describe('1-based starting index of this page as returned by the NOAA CDO API.'),
          })
          .describe('Pagination cursor fields for this response.'),
      })
      .optional()
      .describe('Pagination metadata. Present when the API returns it.'),
  }),

  enrichment: {
    totalCount: z.number().describe('Total number of matching locations before the page limit.'),
    exhausted: z
      .boolean()
      .optional()
      .describe(
        'True when the requested offset is past the end of a non-empty result set — the page is empty but matches exist. Omitted otherwise.',
      ),
    notice: z
      .string()
      .optional()
      .describe(
        'Guidance when no locations matched — echoes applied filters and suggests how to broaden.',
      ),
  },

  errors: [
    {
      reason: 'service_unavailable',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'NOAA CDO API is unreachable or returning errors.',
      retryable: true,
      recovery: 'Wait a moment and retry; NOAA CDO may be temporarily unavailable.',
    },
    {
      reason: 'validation_error',
      code: JsonRpcErrorCode.ValidationError,
      when: 'A filter parameter is not recognized by the NOAA CDO API (e.g., unknown datacategoryId or datasetId).',
      recovery:
        'Verify filter IDs — use noaa_climate_list_data_categories to list valid datacategoryId values and noaa_climate_list_datasets to list valid datasetId values.',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Finding locations', {
      locationCategoryId: input.locationCategoryId,
      datasetId: input.datasetId,
    });

    const service = getCdoService();
    const params = {
      locationcategoryid: input.locationCategoryId,
      datasetid: input.datasetId,
      datacategoryid: input.datacategoryId,
      startdate: input.startDate,
      enddate: input.endDate,
      sortfield: input.sortField,
      sortorder: input.sortOrder,
      limit: input.limit,
      offset: input.offset,
    };
    let response: Awaited<ReturnType<typeof service.findLocations>>;
    try {
      response = await service.findLocations(params, ctx);
    } catch (err) {
      if (err instanceof McpError && err.code === JsonRpcErrorCode.InvalidParams) {
        throw ctx.fail('validation_error', err.message, ctx.recoveryFor('validation_error'));
      }
      throw err;
    }

    const results = (response.results ?? []).map((loc) => ({
      id: loc.id,
      name: loc.name,
      ...(typeof loc.datacoverage === 'number' && { datacoverage: loc.datacoverage }),
      ...(loc.mindate && { mindate: loc.mindate }),
      ...(loc.maxdate && { maxdate: loc.maxdate }),
    }));

    const { totalCount, exhausted } = await resolveCollectionTotal(
      response,
      params,
      ctx,
      (probeParams, probeCtx) => service.findLocations(probeParams, probeCtx),
    );
    ctx.enrich.total(totalCount);
    // ctx.enrich.notice is last-wins — exactly one of these branches may fire.
    if (exhausted) {
      ctx.enrich({ exhausted: true });
      ctx.enrich.notice(
        `Page is empty because offset ${input.offset} is past the end of ${totalCount} matching locations. Lower offset or reset it to 0.`,
      );
    } else if (results.length === 0) {
      const filterHints: string[] = [];
      if (input.locationCategoryId) filterHints.push(`category="${input.locationCategoryId}"`);
      if (input.datasetId) filterHints.push(`datasetId="${input.datasetId}"`);
      const filterStr = filterHints.length > 0 ? ` with ${filterHints.join(', ')}` : '';
      ctx.enrich.notice(
        `No locations matched${filterStr}. Try a different locationCategoryId (e.g., ST, CITY, CNTRY) or remove date range filters.`,
      );
    }

    return {
      results,
      metadata: response.metadata,
    };
  },

  format(result) {
    const lines: string[] = [];
    const meta = result.metadata?.resultset;
    if (meta) {
      lines.push(
        `**Total:** ${meta.count} | **Limit:** ${meta.limit} | **Offset:** ${meta.offset}`,
      );
    }
    if (result.results.length === 0) {
      lines.push('\n_No records on this page._');
      return [{ type: 'text', text: lines.join('\n') }];
    }
    lines.push('');
    for (const loc of result.results) {
      const datePart = loc.mindate && loc.maxdate ? ` | ${loc.mindate} – ${loc.maxdate}` : '';
      const coveragePart =
        typeof loc.datacoverage === 'number'
          ? ` | Coverage: ${(loc.datacoverage * 100).toFixed(0)}%`
          : '';
      lines.push(`- **\`${loc.id}\`** — ${loc.name}${datePart}${coveragePart}`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
