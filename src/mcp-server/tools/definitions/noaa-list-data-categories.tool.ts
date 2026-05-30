/**
 * @fileoverview List NOAA CDO data categories that group related data types.
 * @module mcp-server/tools/definitions/noaa-list-data-categories
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getCdoService } from '@/services/cdo/cdo-service.js';

export const noaaListDataCategories = tool('noaa_list_data_categories', {
  title: 'List NOAA CDO Data Categories',
  description:
    'List data categories that group related data types — Temperature, Precipitation, Wind, Pressure, Sunshine, Sky cover, Weather Type, and more. Use to discover what types of measurements are available before calling noaa_list_data_types. Optionally filter by dataset, location, station, or date range. There are ~41 categories in total.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  input: z.object({
    datasetId: z
      .string()
      .optional()
      .describe(
        'Filter to categories available in this dataset (e.g., "GHCND", "GSOM"). Optional.',
      ),
    locationId: z
      .string()
      .optional()
      .describe('Filter to categories available at this location ID. Optional.'),
    stationId: z
      .string()
      .optional()
      .describe('Filter to categories available at this station ID. Optional.'),
    startDate: z
      .string()
      .optional()
      .describe('Filter to categories with data on or after this ISO date (YYYY-MM-DD). Optional.'),
    endDate: z
      .string()
      .optional()
      .describe(
        'Filter to categories with data on or before this ISO date (YYYY-MM-DD). Optional.',
      ),
    sortField: z.enum(['id', 'name']).optional().describe('Sort results by this field. Optional.'),
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
            id: z.string().describe('Data category ID (e.g., TEMP, PRCP, WIND).'),
            name: z.string().describe('Human-readable category name.'),
          })
          .describe('A single data category entry.'),
      )
      .describe('Matching data categories.'),
    metadata: z
      .object({
        resultset: z
          .object({
            count: z.number().describe('Total number of matching categories.'),
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
    totalCount: z
      .number()
      .describe('Total number of matching data categories before the page limit.'),
    notice: z
      .string()
      .optional()
      .describe(
        'Guidance when no data categories matched — echoes applied filters and suggests how to broaden.',
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
  ],

  async handler(input, ctx) {
    ctx.log.info('Listing data categories', {
      datasetId: input.datasetId,
      locationId: input.locationId,
    });

    const service = getCdoService();
    const response = await service.listDataCategories(
      {
        datasetid: input.datasetId,
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

    const results = response.results ?? [];
    const totalCount = response.metadata?.resultset.count ?? results.length;
    ctx.enrich.total(totalCount);
    if (results.length === 0) {
      ctx.enrich.notice(
        'No data categories matched the applied filters. Try removing location, station, or date range filters to see all available categories.',
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
      lines.push('\n_No categories matched the filters._');
      return [{ type: 'text', text: lines.join('\n') }];
    }
    lines.push('');
    for (const cat of result.results) {
      lines.push(`- **\`${cat.id}\`** — ${cat.name}`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
