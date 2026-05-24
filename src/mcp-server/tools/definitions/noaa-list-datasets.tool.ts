/**
 * @fileoverview List available NOAA CDO datasets with IDs, names, and temporal coverage.
 * @module mcp-server/tools/definitions/noaa-list-datasets
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getCdoService } from '@/services/cdo/cdo-service.js';

export const noaaListDatasets = tool('noaa_list_datasets', {
  title: 'List NOAA CDO Datasets',
  description:
    'List available NOAA CDO datasets with their IDs, names, and temporal coverage. Returns all ~11 datasets by default (no required parameters). Optionally filter to datasets that contain a specific data type, cover a location or station, or overlap a date range. Common datasets: GHCND (daily observations, 1763–present), GSOM (monthly summaries), GSOY (annual summaries), NORMAL_DLY/MLY/ANN/HLY (1981–2010 climate normals). Use this first to discover available datasets before calling noaa_fetch_data.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  input: z.object({
    datatypeId: z
      .array(z.string())
      .optional()
      .describe(
        'Filter to datasets containing these data type IDs (e.g., ["TMAX", "PRCP"]). Optional.',
      ),
    locationId: z
      .string()
      .optional()
      .describe('Filter to datasets covering this location ID (e.g., "FIPS:37" for NC). Optional.'),
    stationId: z
      .string()
      .optional()
      .describe(
        'Filter to datasets covering this station ID (e.g., "GHCND:USC00450974"). Optional.',
      ),
    startDate: z
      .string()
      .optional()
      .describe('Filter to datasets with data on or after this ISO date (YYYY-MM-DD). Optional.'),
    endDate: z
      .string()
      .optional()
      .describe('Filter to datasets with data on or before this ISO date (YYYY-MM-DD). Optional.'),
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
            id: z.string().describe('Dataset ID (e.g., GHCND, GSOM, GSOY).'),
            name: z.string().describe('Human-readable dataset name.'),
            datacoverage: z
              .number()
              .describe('Fractional data coverage (0–1). Higher is more complete.'),
            mindate: z.string().describe('Earliest date available in the dataset (YYYY-MM-DD).'),
            maxdate: z.string().describe('Latest date available in the dataset (YYYY-MM-DD).'),
          })
          .describe('A single CDO dataset entry.'),
      )
      .describe('Matching datasets.'),
    metadata: z
      .object({
        resultset: z
          .object({
            count: z.number().describe('Total number of matching datasets.'),
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

  errors: [
    {
      reason: 'service_unavailable',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'NOAA CDO API is unreachable or returning errors.',
      retryable: true,
      recovery: 'Wait a moment and retry; NOAA CDO may be temporarily unavailable.',
    },
    {
      reason: 'invalid_params',
      code: JsonRpcErrorCode.InvalidParams,
      when: 'Bad date format or unrecognized filter ID.',
      recovery: 'Check date format (YYYY-MM-DD) and verify filter IDs are valid CDO identifiers.',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Listing datasets', {
      datatypeId: input.datatypeId,
      locationId: input.locationId,
      stationId: input.stationId,
    });

    const service = getCdoService();
    const response = await service.listDatasets(
      {
        datatypeid: input.datatypeId,
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

    return {
      results: response.results ?? [],
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
      lines.push('\n_No datasets matched the filters._');
      return [{ type: 'text', text: lines.join('\n') }];
    }
    lines.push('');
    for (const ds of result.results) {
      lines.push(`## ${ds.name} (\`${ds.id}\`)`);
      lines.push(
        `**Coverage:** ${(ds.datacoverage * 100).toFixed(0)}% | **Date range:** ${ds.mindate} – ${ds.maxdate}`,
      );
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
