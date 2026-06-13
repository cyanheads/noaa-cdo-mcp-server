#!/usr/bin/env node
/**
 * @fileoverview noaa-cdo-mcp-server MCP server entry point.
 * @module index
 */

import { createApp } from '@cyanheads/mcp-ts-core';
import { noaaDatasetsResource } from './mcp-server/resources/definitions/noaa-datasets.resource.js';
import { noaaStationResource } from './mcp-server/resources/definitions/noaa-station.resource.js';
import { noaaFetchData } from './mcp-server/tools/definitions/noaa-fetch-data.tool.js';
import { noaaFindLocations } from './mcp-server/tools/definitions/noaa-find-locations.tool.js';
import { noaaFindStations } from './mcp-server/tools/definitions/noaa-find-stations.tool.js';
import { noaaGetStation } from './mcp-server/tools/definitions/noaa-get-station.tool.js';
import { noaaListDataCategories } from './mcp-server/tools/definitions/noaa-list-data-categories.tool.js';
import { noaaListDataTypes } from './mcp-server/tools/definitions/noaa-list-data-types.tool.js';
import { noaaListDatasets } from './mcp-server/tools/definitions/noaa-list-datasets.tool.js';
import { initCdoService } from './services/cdo/cdo-service.js';

await createApp({
  name: 'noaa-cdo-mcp-server',
  title: 'noaa-cdo-mcp-server',
  tools: [
    noaaListDatasets,
    noaaListDataCategories,
    noaaListDataTypes,
    noaaFindLocations,
    noaaFindStations,
    noaaGetStation,
    noaaFetchData,
  ],
  resources: [noaaDatasetsResource, noaaStationResource],
  prompts: [],
  instructions: `NOAA Climate Data Online (CDO) API v2 — historical weather observations and climate data.
Primary workflow: noaa_find_locations → noaa_find_stations → noaa_fetch_data.
Discovery: noaa_list_datasets → noaa_list_data_categories → noaa_list_data_types.
Date range limits: daily datasets (GHCND etc.) max 1 year per request; monthly/annual (GSOM, GSOY) max 10 years.
Always pass units=metric or units=standard to noaa_fetch_data — raw GHCND values are tenths-of-unit integers.`,
  landing: { requireAuth: false },
  setup() {
    initCdoService();
  },
});
