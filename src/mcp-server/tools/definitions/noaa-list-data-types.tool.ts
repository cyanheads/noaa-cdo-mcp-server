/**
 * @fileoverview List available NOAA CDO data types (measurement labels) for a dataset or category.
 * @module mcp-server/tools/definitions/noaa-list-data-types
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode, McpError } from '@cyanheads/mcp-ts-core/errors';
import { getCdoService } from '@/services/cdo/cdo-service.js';

export const noaaListDataTypes = tool('noaa_list_data_types', {
  title: 'List NOAA CDO Data Types',
  description:
    'List available data types (measurement labels like TMAX, TMIN, PRCP, SNOW) for a given dataset or category. Pass a datasetId to see what is measured in that dataset, or a datacategoryId (e.g., "TEMP") to see all temperature-related types. Hundreds of types exist across all datasets. Use this before calling noaa_fetch_data when the data type IDs are unknown. Common GHCND types: TMAX (max temperature), TMIN (min temperature), PRCP (precipitation), SNOW (snowfall), SNWD (snow depth), AWND (average wind speed).',
  annotations: { readOnlyHint: true, openWorldHint: false },
  input: z.object({
    datasetId: z
      .string()
      .optional()
      .describe(
        'Filter to data types available in this dataset (e.g., "GHCND", "GSOM"). Optional.',
      ),
    datacategoryId: z
      .string()
      .optional()
      .describe(
        'Filter to data types in this category (e.g., "TEMP" for temperature types, "PRCP" for precipitation). Optional.',
      ),
    locationId: z
      .string()
      .optional()
      .describe('Filter to data types available at this location ID. Optional.'),
    stationId: z
      .string()
      .optional()
      .describe('Filter to data types available at this station ID. Optional.'),
    startDate: z
      .string()
      .optional()
      .describe('Filter to data types with data on or after this ISO date (YYYY-MM-DD). Optional.'),
    endDate: z
      .string()
      .optional()
      .describe(
        'Filter to data types with data on or before this ISO date (YYYY-MM-DD). Optional.',
      ),
    sortField: z
      .enum(['id', 'name', 'mindate', 'maxdate', 'datacoverage'])
      .optional()
      .describe('Sort results by this field. Optional.'),
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
            id: z.string().describe('Data type ID (e.g., TMAX, TMIN, PRCP).'),
            name: z.string().describe('Human-readable data type name.'),
            datacoverage: z
              .number()
              .optional()
              .describe('Fractional data coverage (0–1). Omitted when not provided by the API.'),
            mindate: z
              .string()
              .optional()
              .describe(
                'Earliest date this data type is available (YYYY-MM-DD). Omitted when not provided.',
              ),
            maxdate: z
              .string()
              .optional()
              .describe(
                'Latest date this data type is available (YYYY-MM-DD). Omitted when not provided.',
              ),
          })
          .describe('A single data type entry.'),
      )
      .describe('Matching data types.'),
    metadata: z
      .object({
        resultset: z
          .object({
            count: z.number().describe('Total number of matching data types.'),
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
    totalCount: z.number().describe('Total number of matching data types before the page limit.'),
    notice: z
      .string()
      .optional()
      .describe(
        'Guidance when no data types matched — echoes applied filters and suggests how to broaden.',
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
        'Verify filter IDs — use noaa_list_data_categories to list valid datacategoryId values and noaa_list_datasets to list valid datasetId values.',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Listing data types', {
      datasetId: input.datasetId,
      datacategoryId: input.datacategoryId,
    });

    const service = getCdoService();
    let response: Awaited<ReturnType<typeof service.listDataTypes>>;
    try {
      response = await service.listDataTypes(
        {
          datasetid: input.datasetId,
          datacategoryid: input.datacategoryId,
          locationid: input.locationId,
          stationid: input.stationId,
          startdate: input.startDate,
          enddate: input.endDate,
          sortfield: input.sortField,
          sortorder: input.sortOrder,
          limit: input.limit,
          offset: input.offset,
        },
        ctx,
      );
    } catch (err) {
      if (err instanceof McpError && err.code === JsonRpcErrorCode.InvalidParams) {
        throw ctx.fail('validation_error', err.message, {
          recovery: {
            hint: 'Verify filter IDs — use noaa_list_data_categories to list valid datacategoryId values and noaa_list_datasets to list valid datasetId values.',
          },
        });
      }
      throw err;
    }

    const results = (response.results ?? []).map((dt) => ({
      id: dt.id,
      name: dt.name,
      ...(typeof dt.datacoverage === 'number' && { datacoverage: dt.datacoverage }),
      ...(dt.mindate && { mindate: dt.mindate }),
      ...(dt.maxdate && { maxdate: dt.maxdate }),
    }));

    const totalCount = response.metadata?.resultset.count ?? results.length;
    ctx.enrich.total(totalCount);
    if (results.length === 0) {
      const filterHints: string[] = [];
      if (input.datasetId) filterHints.push(`datasetId="${input.datasetId}"`);
      if (input.datacategoryId) filterHints.push(`datacategoryId="${input.datacategoryId}"`);
      const filterStr = filterHints.length > 0 ? ` with ${filterHints.join(', ')}` : '';
      ctx.enrich.notice(
        `No data types matched${filterStr}. Try a different datasetId (e.g., GHCND, GSOM) or datacategoryId (e.g., TEMP, PRCP, WIND).`,
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
      lines.push('\n_No data types matched the filters._');
      return [{ type: 'text', text: lines.join('\n') }];
    }
    lines.push('');
    for (const dt of result.results) {
      const coveragePart =
        typeof dt.datacoverage === 'number'
          ? ` | **Coverage:** ${(dt.datacoverage * 100).toFixed(0)}%`
          : '';
      const datePart =
        dt.mindate && dt.maxdate ? ` | **Range:** ${dt.mindate} – ${dt.maxdate}` : '';
      lines.push(`- **\`${dt.id}\`** — ${dt.name}${coveragePart}${datePart}`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
