/**
 * @fileoverview Regression guard for the tool-name namespace. Pins every tool to the
 * `noaa_climate_*` prefix established by the noaa-cdo → noaa-climate rename, so a future
 * edit cannot silently reintroduce a bare `noaa_*` identifier or drift a tool name.
 * @module tests/tool-naming.test
 */

import { describe, expect, it } from 'vitest';
import { noaaClimateFetchData } from '@/mcp-server/tools/definitions/noaa-climate-fetch-data.tool.js';
import { noaaClimateFindLocations } from '@/mcp-server/tools/definitions/noaa-climate-find-locations.tool.js';
import { noaaClimateFindStations } from '@/mcp-server/tools/definitions/noaa-climate-find-stations.tool.js';
import { noaaClimateGetStation } from '@/mcp-server/tools/definitions/noaa-climate-get-station.tool.js';
import { noaaClimateListDataCategories } from '@/mcp-server/tools/definitions/noaa-climate-list-data-categories.tool.js';
import { noaaClimateListDataTypes } from '@/mcp-server/tools/definitions/noaa-climate-list-data-types.tool.js';
import { noaaClimateListDatasets } from '@/mcp-server/tools/definitions/noaa-climate-list-datasets.tool.js';

const tools = [
  noaaClimateListDatasets,
  noaaClimateListDataCategories,
  noaaClimateListDataTypes,
  noaaClimateFindLocations,
  noaaClimateFindStations,
  noaaClimateGetStation,
  noaaClimateFetchData,
];

describe('tool naming', () => {
  it('registers exactly the noaa_climate_* tool set', () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'noaa_climate_fetch_data',
        'noaa_climate_find_locations',
        'noaa_climate_find_stations',
        'noaa_climate_get_station',
        'noaa_climate_list_data_categories',
        'noaa_climate_list_data_types',
        'noaa_climate_list_datasets',
      ].sort(),
    );
  });

  it('every tool carries the noaa_climate_ prefix', () => {
    for (const t of tools) {
      expect(t.name).toMatch(/^noaa_climate_/);
    }
  });
});
