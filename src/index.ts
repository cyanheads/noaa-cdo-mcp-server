#!/usr/bin/env node
/**
 * @fileoverview noaa-climate-mcp-server MCP server entry point.
 * @module index
 */

import { createApp } from '@cyanheads/mcp-ts-core';
import { noaaDatasetsResource } from './mcp-server/resources/definitions/noaa-datasets.resource.js';
import { noaaStationResource } from './mcp-server/resources/definitions/noaa-station.resource.js';
import { noaaClimateFetchData } from './mcp-server/tools/definitions/noaa-climate-fetch-data.tool.js';
import { noaaClimateFindLocations } from './mcp-server/tools/definitions/noaa-climate-find-locations.tool.js';
import { noaaClimateFindStations } from './mcp-server/tools/definitions/noaa-climate-find-stations.tool.js';
import { noaaClimateGetStation } from './mcp-server/tools/definitions/noaa-climate-get-station.tool.js';
import { noaaClimateListDataCategories } from './mcp-server/tools/definitions/noaa-climate-list-data-categories.tool.js';
import { noaaClimateListDataTypes } from './mcp-server/tools/definitions/noaa-climate-list-data-types.tool.js';
import { noaaClimateListDatasets } from './mcp-server/tools/definitions/noaa-climate-list-datasets.tool.js';
import { initCdoService } from './services/cdo/cdo-service.js';

await createApp({
  name: 'noaa-climate-mcp-server',
  title: 'noaa-climate-mcp-server',
  tools: [
    noaaClimateListDatasets,
    noaaClimateListDataCategories,
    noaaClimateListDataTypes,
    noaaClimateFindLocations,
    noaaClimateFindStations,
    noaaClimateGetStation,
    noaaClimateFetchData,
  ],
  resources: [noaaDatasetsResource, noaaStationResource],
  prompts: [],
  instructions: `NOAA Climate Data Online (CDO) API v2 — historical weather observations and climate data.
Primary workflow: noaa_climate_find_locations → noaa_climate_find_stations → noaa_climate_fetch_data.
Discovery: noaa_climate_list_datasets → noaa_climate_list_data_categories → noaa_climate_list_data_types.
Date range limits: daily datasets (GHCND etc.) max 1 year per request; monthly/annual (GSOM, GSOY) max 10 years.
Always pass units=metric or units=standard to noaa_climate_fetch_data — raw GHCND values are tenths-of-unit integers.`,
  landing: { requireAuth: false },
  setup() {
    initCdoService();
  },
});
