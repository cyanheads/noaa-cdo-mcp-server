/**
 * @fileoverview Fetch historical NOAA CDO observation data for a dataset and date range.
 * @module mcp-server/tools/definitions/noaa-fetch-data
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getCdoService } from '@/services/cdo/cdo-service.js';

/** Datasets limited to 1-year date ranges per request. */
const DAILY_DATASETS = new Set(['GHCND', 'PRECIP_15', 'PRECIP_HLY', 'NORMAL_DLY', 'NORMAL_HLY']);

/** Datasets limited to 10-year date ranges per request. */
const MONTHLY_DATASETS = new Set(['GSOM', 'GSOY', 'NORMAL_MLY', 'NORMAL_ANN']);

/** Return the max allowed date-range days for a given datasetId, or undefined when unknown. */
function maxRangeForDataset(datasetId: string): number | undefined {
  const upper = datasetId.toUpperCase();
  if (DAILY_DATASETS.has(upper)) return 365;
  if (MONTHLY_DATASETS.has(upper)) return 3650;
  return;
}

/** Count calendar days between two ISO date strings (inclusive). */
function daysBetween(start: string, end: string): number {
  const msPerDay = 86_400_000;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / msPerDay) + 1;
}

export const noaaFetchData = tool('noaa_fetch_data', {
  title: 'Fetch NOAA CDO Observation Data',
  description:
    'Fetch historical observation records from a NOAA CDO dataset for a given date range. Requires datasetId (e.g., GHCND for daily, GSOM for monthly), startDate, and endDate. Optionally scope to specific stations, locations, and data types. Date range limits per request: sub-daily and daily datasets (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY) are limited to 1 year; monthly and annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) are limited to 10 years. For climate normals (NORMAL_*), use startDate=2010-01-01 and endDate=2010-12-31 — that is the API proxy year regardless of which 30-year period is being described. Returns flat tuples of { date, datatype, station, value, attributes }. Strongly recommended: pass units=metric or units=standard — without it, GHCND values are raw tenths-of-unit integers (TMAX=256 = 25.6°C, PRCP=12 = 1.2mm). GSOM/GSOY are already scaled.',
  annotations: { readOnlyHint: true, openWorldHint: true },
  input: z.object({
    datasetId: z
      .string()
      .min(1)
      .describe(
        'Dataset ID to query (e.g., GHCND for daily data, GSOM for monthly, GSOY for annual, NORMAL_DLY/MLY/ANN/HLY for 1981–2010 climate normals). Determines date range limit: GHCND/PRECIP_*/NORMAL_DLY/NORMAL_HLY allow 1-year max per request; GSOM/GSOY/NORMAL_MLY/NORMAL_ANN allow 10-year max.',
      ),
    startDate: z
      .string()
      .describe(
        'Start date for observations (YYYY-MM-DD). For NORMAL_* datasets use 2010-01-01 regardless of the years being analyzed — 2010 is the API proxy year for all normals.',
      ),
    endDate: z
      .string()
      .describe(
        'End date for observations (YYYY-MM-DD). Must be within 1 year of startDate for sub-daily/daily datasets (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY) or within 10 years for monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN). For any NORMAL_* dataset use 2010-12-31.',
      ),
    stationId: z
      .array(z.string())
      .optional()
      .describe(
        'One or more station IDs to filter by (e.g., ["GHCND:USC00450974"]). Obtain from noaa_find_stations. Multiple IDs return comparative readings across stations. Optional.',
      ),
    locationId: z
      .array(z.string())
      .optional()
      .describe(
        'One or more location IDs to filter by (e.g., ["FIPS:37", "ZIP:98101"]). Broader than stationId — returns data from all stations within the location. Optional.',
      ),
    datatypeId: z
      .array(z.string())
      .optional()
      .describe(
        'One or more data type IDs to include (e.g., ["TMAX", "TMIN", "PRCP"]). Without this, all data types for the dataset are returned. Use noaa_list_data_types to discover valid IDs. Optional.',
      ),
    units: z
      .enum(['standard', 'metric'])
      .optional()
      .describe(
        'Unit system for returned values. Without this parameter, GHCND returns raw tenths-of-unit integers (TMAX=256 = 25.6°C). Strongly recommended: pass metric (SI units) or standard (Fahrenheit/inches). Optional.',
      ),
    includemetadata: z
      .boolean()
      .default(true)
      .describe('Include pagination metadata in the response. Defaults to true.'),
    sortField: z
      .enum(['datatype', 'date', 'station'])
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
      .describe('Maximum number of records to return (1–1000). Defaults to 25.'),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Zero-based index of the first record to return for pagination. Defaults to 0.'),
  }),
  output: z.object({
    results: z
      .array(
        z
          .object({
            date: z.string().describe('Observation date-time in ISO 8601 format.'),
            datatype: z.string().describe('Data type ID (e.g., TMAX, PRCP).'),
            station: z.string().describe('Station ID that recorded this observation.'),
            value: z
              .number()
              .describe(
                'Observed value. Unit depends on the dataset and units parameter. For GHCND without units, this is a raw tenths-of-unit integer.',
              ),
            attributes: z
              .string()
              .optional()
              .describe('Quality flags and measurement attributes. Omitted when not provided.'),
          })
          .describe('A single observation record.'),
      )
      .describe('Flat array of observation records sorted by date by default.'),
    metadata: z
      .object({
        resultset: z
          .object({
            count: z.number().describe('Total number of matching records.'),
            limit: z.number().describe('Page size used for this response.'),
            offset: z
              .number()
              .describe('1-based starting index of this page as returned by the NOAA CDO API.'),
          })
          .describe('Pagination cursor fields for this response.'),
      })
      .optional()
      .describe('Pagination metadata. Present when includemetadata=true.'),
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
      reason: 'date_range_exceeded',
      code: JsonRpcErrorCode.ValidationError,
      when: 'Date range exceeds 1 year for sub-daily/daily datasets (GHCND, PRECIP_*, NORMAL_DLY, NORMAL_HLY) or 10 years for monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN).',
      recovery:
        'Narrow the date range or split into multiple requests. For NORMAL_* datasets use startDate=2010-01-01 and endDate=2010-12-31.',
    },
    {
      reason: 'validation_error',
      code: JsonRpcErrorCode.ValidationError,
      when: 'Bad dataset ID, date format, or unknown station/location/datatype ID.',
      recovery:
        'Verify the datasetId, date format (YYYY-MM-DD), and all filter IDs. Use noaa_list_datasets, noaa_find_stations, and noaa_list_data_types to confirm valid IDs.',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Fetching data', {
      datasetId: input.datasetId,
      startDate: input.startDate,
      endDate: input.endDate,
      stationId: input.stationId,
      datatypeId: input.datatypeId,
    });

    // Validate date range against known dataset limits
    const maxDays = maxRangeForDataset(input.datasetId);
    if (maxDays !== undefined) {
      const days = daysBetween(input.startDate, input.endDate);
      if (days > maxDays) {
        const limit = maxDays === 365 ? '1 year' : '10 years';
        throw ctx.fail(
          'date_range_exceeded',
          `Date range of ${days} days exceeds the ${maxDays}-day (${limit}) limit for dataset "${input.datasetId}".`,
          {
            datasetId: input.datasetId,
            requestedDays: days,
            maxDays,
            recovery: {
              hint: `Narrow the date range to ≤${limit} per request, or split into multiple calls. For NORMAL_* datasets use startDate=2010-01-01 and endDate=2010-12-31.`,
            },
          },
        );
      }
    }

    const service = getCdoService();
    const response = await service.fetchData(
      {
        datasetid: input.datasetId,
        startdate: input.startDate,
        enddate: input.endDate,
        stationid: input.stationId,
        locationid: input.locationId,
        datatypeid: input.datatypeId,
        units: input.units,
        includemetadata: input.includemetadata,
        sortfield: input.sortField,
        sortorder: input.sortOrder,
        limit: input.limit,
        offset: input.offset,
      },
      ctx,
    );

    const results = (response.results ?? []).map((rec) => ({
      date: rec.date,
      datatype: rec.datatype,
      station: rec.station,
      value: rec.value,
      ...(rec.attributes && { attributes: rec.attributes }),
    }));

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
        `**Total records:** ${meta.count} | **Limit:** ${meta.limit} | **Offset:** ${meta.offset}`,
      );
    }
    if (result.results.length === 0) {
      lines.push('\n_No observation records matched the query._');
      return [{ type: 'text', text: lines.join('\n') }];
    }
    lines.push('');
    lines.push('| Date | Type | Station | Value | Attributes |');
    lines.push('|:-----|:-----|:--------|------:|:-----------|');
    for (const rec of result.results) {
      const attrs = rec.attributes ?? '';
      lines.push(`| ${rec.date} | ${rec.datatype} | ${rec.station} | ${rec.value} | ${attrs} |`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
