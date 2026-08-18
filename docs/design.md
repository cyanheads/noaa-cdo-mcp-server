# noaa-climate-mcp-server — Design

## MCP Surface

### Tools

| Name | Description | Key Inputs | Annotations |
|:-----|:------------|:-----------|:------------|
| `noaa_climate_list_datasets` | List available NOAA CDO datasets, optionally filtered by data type, location, station, or date range. Returns dataset IDs, names, and temporal coverage. | `datatypeId[]?`, `locationId?`, `startDate?`, `endDate?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_climate_list_data_types` | List available data types (TMAX, TMIN, PRCP, SNOW, etc.), optionally filtered by dataset, data category, location, or station. Use to discover what measurements are available before querying data. | `datasetId?`, `datacategoryId?`, `locationId?`, `stationId?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_climate_list_data_categories` | List data categories (Temperature, Precipitation, Wind, etc.) that group related data types. Optionally filter by dataset, location, or station. | `datasetId?`, `locationId?`, `stationId?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_climate_list_location_categories` | List the 12 location categories that scope location search. Pagination and sort only — CDO ignores every domain filter on `/locationcategories`. | `sortField?`, `sortOrder?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_climate_find_locations` | Search for locations by category (country, state, county, city, zip, climate region). Optionally filter by dataset, data category, and date range, or by name via the client-side `nameContains` filter. Use to discover location IDs for narrowing station and data queries. | `locationCategoryId?`, `nameContains?`, `datasetId?`, `datacategoryId?`, `startDate?`, `endDate?`, `sortField?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: true` |
| `noaa_climate_find_stations` | Search for weather stations by location, bounding box, dataset, data type, and date range. Returns station IDs, names, coordinates, and data coverage metadata. | `locationId?`, `extent?`, `datasetId?`, `datatypeId?`, `datacategoryId?`, `startDate?`, `endDate?`, `sortField?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: true` |
| `noaa_climate_get_station` | Fetch full metadata for a single station by ID, including name, coordinates, elevation, and data coverage dates. | `stationId` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_climate_fetch_data` | Fetch historical observation data for a dataset, date range, and one or more stations or locations. Returns time-series values for the requested data types. | `datasetId`, `startDate`, `endDate`, `stationId[]?`, `locationId[]?`, `datatypeId[]?`, `units?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: true` |

### Resources

| URI Template | Description | Pagination |
|:-------------|:------------|:-----------|
| `noaa://datasets` | All available CDO datasets with IDs, names, and temporal coverage. | Stable small list (11–13 datasets via the API) — no pagination needed |
| `noaa://stations/{stationId}` | Station metadata by ID (name, coordinates, elevation, data coverage). | n/a |

### Prompts

None. This is a data-access server; no recurring interaction templates are warranted.

---

## Overview

`noaa-climate-mcp-server` exposes NOAA's Climate Data Online (CDO) API v2 to LLM agents. It provides access to historical weather observations, climate summaries, and station metadata going back centuries. The primary use case is answering questions like "what's the historical climate at location X?" or "what were the temperatures and precipitation at station Y between these dates?"

It complements the `nws-weather-mcp-server` (real-time forecasts and alerts) by providing the historical record — together they form a complete weather data stack for agents.

The API wraps `https://www.ncei.noaa.gov/cdo-web/api/v2/`.

## Requirements

- Read-only access to NOAA CDO API v2
- API token required (free registration at ncdc.noaa.gov/cdo-web/token; token passed as `token` request header)
- Rate limits: 5 requests/second, 10,000 requests/day per token
- Seven endpoints exposed: datasets, datacategories, datatypes, locationcategories, locations, stations, data
- Date range constraints: sub-daily, daily, and radar data (GHCND, PRECIP_*, NORMAL_DLY, NORMAL_HLY, NEXRAD2, NEXRAD3) limited to 1-year ranges per request; monthly/annual data (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) limited to 10-year ranges
- Pagination: offset/limit pattern; max 1000 results per request
- Units: `standard` or `metric` for data endpoint; no scaling without explicit `units` param
- Base URL: `https://www.ncei.noaa.gov/cdo-web/api/v2/`

## Services

| Service | Wraps | Used By |
|:--------|:------|:--------|
| `CdoService` | NOAA CDO API v2 (`https://www.ncei.noaa.gov/cdo-web/api/v2/`) | All tools, both resources |

**Parameter name translation.** MCP input schemas use camelCase (`datasetId`, `locationId`, `stationId`, `datatypeId`, `datacategoryId`). The CDO API requires all lowercase (`datasetid`, `locationid`, `stationid`, `datatypeid`, `datacategoryid`). `CdoService` is responsible for this translation — do not rely on the caller to pass lowercase keys.

## Config

| Env Var | Required | Description |
|:--------|:---------|:------------|
| `NOAA_CDO_TOKEN` | Yes | API token from ncdc.noaa.gov/cdo-web/token. Sent as `token` header on every request. |

## Implementation Order

1. Config (`src/config/server-config.ts`) — `NOAA_CDO_TOKEN` via `parseEnvConfig`
2. `CdoService` — typed HTTP client with retry, rate-limit handling, pagination helper
3. `noaa_climate_list_datasets`, `noaa_climate_list_data_categories`, `noaa_climate_list_data_types` — reference/discovery tools (simplest; no required params)
4. `noaa_climate_find_locations` — location search (required for navigation workflows)
5. `noaa_climate_find_stations`, `noaa_climate_get_station` — station discovery and lookup
6. `noaa_climate_fetch_data` — observation data retrieval (most complex; requires all prior pieces)
7. Resources: `noaa://datasets` (small, stable list), `noaa://stations/{stationId}` (wraps get_station)

Each step is independently testable against the live API.

---

## Domain Mapping

The NOAA CDO data model has five entity types and one data-fetch endpoint:

| Entity | API Endpoint | Key ID Format | Notes |
|:-------|:-------------|:-------------|:------|
| Dataset | `/datasets` or `/datasets/{id}` | `GHCND`, `GSOM`, `GSOY`, `NORMAL_DLY`, `NORMAL_MLY`, `NORMAL_ANN`, `NORMAL_HLY`, `PRECIP_15`, `PRECIP_HLY`, `NEXRAD2`, `NEXRAD3` | 11–13 via API; primary ones are GHCND, GSOM, GSOY, NORMAL_DLY |
| Data category | `/datacategories` or `/datacategories/{id}` | `TEMP`, `PRCP`, `WIND`, `PRES`, `SUN`, `SKY`, `WXTYPE`, `ANNAGR`, etc. | ~41 categories; groups data types |
| Data type | `/datatypes` or `/datatypes/{id}` | `TMAX`, `TMIN`, `TOBS`, `PRCP`, `SNOW`, `SNWD`, `AWND`, etc. | Hundreds; the actual measurement labels |
| Location category | `/locationcategories` | `CITY`, `CLIM_DIV`, `CLIM_REG`, `CNTRY`, `CNTY`, `HYD_ACC`, `HYD_CAT`, `HYD_REG`, `HYD_SUB`, `ST`, `US_TERR`, `ZIP` | 12 categories; hierarchical geography |
| Location | `/locations` or `/locations/{id}` | `FIPS:37` (state), `CITY:US390029`, `ZIP:28801`, `FIPS:US` (country) | Filtered by `locationcategoryid` |
| Station | `/stations` or `/stations/{id}` | `GHCND:USC00010008`, `COOP:010008` | Supports bounding box via `extent` param |
| Data | `/data` | n/a (query-only) | Requires `datasetid`, `startdate`, `enddate`; returns `{date, datatype, station, value, attributes}` |

### Key Dataset Reference

| Dataset ID | Name | Temporal Granularity | Date Range |
|:-----------|:-----|:---------------------|:-----------|
| `GHCND` | Global Historical Climatology Network Daily | Daily | 1763–present |
| `GSOM` | Global Summary of the Month | Monthly | 1763–present |
| `GSOY` | Global Summary of the Year | Annual | 1763–present |
| `NORMAL_DLY` | Normals Daily | Daily (30-year norms) | 2010-01-01–2010-12-31 |
| `NORMAL_MLY` | Normals Monthly | Monthly (30-year norms) | 2010-01-01–2010-12-31 |
| `NORMAL_ANN` | Normals Annual/Seasonal | Annual (30-year norms) | 2010-01-01–2010-12-31 |
| `NORMAL_HLY` | Normals Hourly | Hourly (30-year norms) | 2010-01-01–2010-12-31 |
| `PRECIP_15` | Precipitation 15 Minute | 15-minute intervals | 1970–present |
| `PRECIP_HLY` | Precipitation Hourly | Hourly | 1900–present |

### Core Data Types (GHCND/GSOM)

| Data Type ID | Description | Unit (standard) |
|:-------------|:------------|:----------------|
| `TMAX` | Maximum temperature | Tenths of °C |
| `TMIN` | Minimum temperature | Tenths of °C |
| `TOBS` | Temperature at observation time | Tenths of °C |
| `PRCP` | Precipitation | Tenths of mm |
| `SNOW` | Snowfall | mm |
| `SNWD` | Snow depth | mm |
| `AWND` | Average wind speed | Tenths of m/s |
| `WDF2` | Direction of fastest 2-minute wind | Degrees |
| `WSF2` | Fastest 2-minute wind speed | Tenths of m/s |

---

## Workflow Analysis

### Primary workflow: station → data

The most common agent workflow is "find stations near a place, then query historical data":

| Step | Tool | What it does |
|:-----|:-----|:-------------|
| 1 | `noaa_climate_find_locations` | Find a location ID for a city, state, or zip — e.g., `CITY:US530018` for Seattle |
| 2 | `noaa_climate_find_stations` | Find stations within that location that support the desired dataset and data types |
| 3 | `noaa_climate_fetch_data` | Fetch observations for chosen stations over the desired date range |

### Discovery workflow: what's available?

When the agent doesn't know what data exists:

| Step | Tool | What it does |
|:-----|:-----|:-------------|
| 1 | `noaa_climate_list_datasets` | See all available datasets and their temporal coverage |
| 2 | `noaa_climate_list_data_categories` | Browse measurement groups (Temperature, Precipitation, etc.) |
| 3 | `noaa_climate_list_data_types` | Get specific measurement IDs (TMAX, PRCP, etc.) for the chosen dataset |

### Climate profile workflow

"What's the typical climate in X?" — uses climate normals:

| Step | Tool | What it does |
|:-----|:-----|:-------------|
| 1 | `noaa_climate_find_stations` | Find stations with `datasetId=NORMAL_DLY` near the location |
| 2 | `noaa_climate_fetch_data` | Query `NORMAL_DLY` with `startDate=2010-01-01`, `endDate=2010-12-31` for the full normal year |

Use `NORMAL_HLY` (hourly) or `NORMAL_MLY` (monthly) for coarser granularity. All normals datasets use the same 2010-proxy date range.

---

## Tool Detail

### `noaa_climate_list_datasets`

- **Description**: List available NOAA CDO datasets with their IDs, names, and temporal coverage. Returns all ~11 datasets by default (no required params). Optionally filter to datasets that contain a specific data type, cover a location or station, or overlap a date range.
- **Input**: `datatypeId?: string[]`, `locationId?: string`, `stationId?: string`, `startDate?: string` (ISO), `endDate?: string` (ISO), `sortField?: enum('id'|'name'|'mindate'|'maxdate'|'datacoverage')`, `sortOrder?: enum('asc'|'desc')`, `limit: number (default 25, max 1000)`, `offset: number (default 0)`
- **Output**: `{ results: Array<{ id, name, datacoverage, mindate, maxdate }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'validation_error', code: ValidationError, when: 'Bad date format or unknown ID' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_climate_list_data_categories`

- **Description**: List data categories that group related data types — Temperature, Precipitation, Wind, etc. Use to discover what types of measurements are available before calling `noaa_climate_list_data_types`. Optionally filter by dataset, location, station, or date range.
- **Input**: `datasetId?: string`, `locationId?: string`, `stationId?: string`, `startDate?: string`, `endDate?: string`, `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ id, name }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_climate_list_data_types`

- **Description**: List available data types (measurement labels like TMAX, TMIN, PRCP, SNOW) for a given dataset or category. Pass a `datasetId` to see what's measured in that dataset, or a `datacategoryId` (e.g., `TEMP`) to see all temperature-related types. Required before querying data when the data type IDs are unknown.
- **Input**: `datasetId?: string`, `datacategoryId?: string`, `locationId?: string`, `stationId?: string`, `startDate?: string`, `endDate?: string`, `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ id, name, datacoverage, mindate, maxdate }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_climate_list_location_categories`

- **Description**: List the location categories that scope `noaa_climate_find_locations` — 12 in total: `CITY`, `CLIM_DIV`, `CLIM_REG`, `CNTRY`, `CNTY`, `HYD_ACC`, `HYD_CAT`, `HYD_REG`, `HYD_SUB`, `ST`, `US_TERR`, `ZIP`. Call it when the `locationCategoryId` to use is unknown.
- **Input**: `sortField?: enum('id'|'name')`, `sortOrder?: enum('asc'|'desc')`, `limit: number (default 25, max 1000)`, `offset: number (default 0)`. No domain filters — CDO ignores `datasetid`, `locationid`, `stationid`, and the date range on `/locationcategories`, verified live.
- **Output**: `{ results: Array<{ id, name }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'validation_error', code: ValidationError, when: 'A pagination or sort parameter is not recognized' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_climate_find_locations`

- **Description**: Search for geographic locations by category (CITY, ST, CNTY, CNTRY, ZIP, CLIM_REG, etc.). Returns location IDs used in station search and data queries. Without `locationCategoryId`, returns all location types. Use `locationCategoryId=ST` to list US states (51), `locationCategoryId=CITY` for cities (1,989). The API has no name-search parameter, so `nameContains` synthesizes one client-side for any category of at most 4,000 locations; past that limit — `ZIP` (30,415) — narrow with `datasetId`/`datacategoryId`, or sort alphabetically with `sortField=name` and page through results. Location IDs follow formats like `FIPS:37` (state), `CITY:US530018` (city), `ZIP:98101`.
- **Input**: `locationCategoryId?: string` (e.g., `ST`, `CITY`, `CNTY`, `CNTRY`, `ZIP`, `US_TERR`, `CLIM_REG`; enumerate with `noaa_climate_list_location_categories`), `nameContains?: string` — case-insensitive substring match applied after a full client-side enumeration of the category; requires `locationCategoryId` and a category of at most 4,000 locations, `datasetId?: string`, `datacategoryId?: string`, `startDate?: string`, `endDate?: string`, `sortField?: enum('id'|'name'|'mindate'|'maxdate'|'datacoverage')`, `sortOrder?: enum('asc'|'desc')`, `limit: number (default 25, max 1000)`, `offset: number (default 0)`
- **Output**: `{ results: Array<{ id, name, datacoverage, mindate, maxdate }>, appliedNameFilter?: string, metadata: { resultset: { count, limit, offset } } }`. With `nameContains` active, `count` is the exact post-filter match total and `offset` echoes the caller's zero-based offset — never CDO's raw echo from the internal enumeration fetch.
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'validation_error', code: ValidationError, when: 'A filter parameter is not recognized by the CDO API' }`, `{ reason: 'name_filter_requires_category', code: ValidationError, when: 'nameContains supplied without locationCategoryId' }`, `{ reason: 'name_filter_category_too_large', code: ValidationError, when: 'The category holds more locations than nameContains can enumerate' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: true`

### `noaa_climate_find_stations`

- **Description**: Search for weather observation stations by location, bounding box, dataset, and data type. Returns station IDs, names, coordinates, elevation, and data coverage dates. Filters by `locationId` (e.g., `FIPS:37` for NC), `extent` (lat/lon bounding box as `"minLat,minLon,maxLat,maxLon"`), `datasetId`, `datatypeId`, and date range. Station IDs returned here are used as `stationId` in `noaa_climate_fetch_data`.
- **Input**: `locationId?: string`, `extent?: string` (e.g., `"47.5,-122.4,47.7,-122.1"`), `datasetId?: string`, `datatypeId?: string[]`, `datacategoryId?: string`, `startDate?: string`, `endDate?: string`, `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ id, name, latitude, longitude, elevation, mindate, maxdate, datacoverage }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: true`

### `noaa_climate_get_station`

- **Description**: Fetch full metadata for a single weather station by its ID (e.g., `GHCND:USW00024233`, `COOP:010008`). Returns name, coordinates, elevation, and the full date range for which data is available. Use when you have a station ID from `noaa_climate_find_stations` and want its details.
- **Input**: `stationId: string` (e.g., `GHCND:USW00024233`)
- **Output**: `{ id, name, latitude, longitude, elevation, mindate, maxdate, datacoverage }`
- **Errors**: `{ reason: 'not_found', code: NotFound, when: 'Station ID format is valid but no station exists with that ID' }`, `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_climate_fetch_data`

- **Description**: Fetch historical observation records from a NOAA CDO dataset for a given date range. Requires a `datasetId` (e.g., `GHCND` for daily, `GSOM` for monthly), `startDate`, and `endDate`. Optionally scope to specific stations, locations, and data types. Sub-daily, daily, and radar data (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY, NEXRAD2, NEXRAD3) is limited to a 1-year date range per request; monthly and annual data (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) is limited to 10 years. Returns a flat array of `{ date, datatype, station, value, attributes }` records. Specify `units=metric` or `units=standard` to scale values; without a `units` parameter, raw unscaled values are returned — for GHCND, temperatures are in tenths of degrees and precipitation in tenths of mm (e.g., raw TMAX=256 → 25.6°C with `units=metric`; raw PRCP=12 → 1.2mm).
- **Input**:
  - `datasetId: string` — `.describe('Dataset ID (e.g., GHCND for daily data, GSOM for monthly, GSOY for annual, NORMAL_DLY/MLY/ANN/HLY for 1981-2010 climate normals, NEXRAD2/NEXRAD3 for weather radar). Determines the date range limit: sub-daily, daily, and radar datasets (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY, NEXRAD2, NEXRAD3) allow 1-year max per request; monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) allow 10-year max.')` 
  - `startDate: string` (ISO date `YYYY-MM-DD`) — `.describe('Start date for observations. For NORMAL_* datasets use 2010-01-01 regardless of the years being analyzed.')`
  - `endDate: string` (ISO date `YYYY-MM-DD`) — `.describe('End date for observations. Must be within 1 year of startDate for sub-daily/daily/radar datasets (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY, NEXRAD2, NEXRAD3) or within 10 years for monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN). For any NORMAL_* dataset use 2010-12-31.')`
  - `stationId?: string[]` — `.describe('One or more station IDs to filter by (e.g., ["GHCND:USW00024233"]). Obtain from noaa_climate_find_stations. Serialized to ampersand-chained query params.')`
  - `locationId?: string[]` — `.describe('One or more location IDs to filter by (e.g., ["FIPS:37", "ZIP:98101"]). Broader than stationId — returns all data within the location.')`
  - `datatypeId?: string[]` — `.describe('One or more data type IDs to include (e.g., ["TMAX","TMIN","PRCP"]). Without this, all data types for the dataset are returned. Use noaa_climate_list_data_types to discover valid IDs.')`
  - `units?: enum('standard'|'metric')` — `.describe('Unit system for returned values. Without this, GHCND returns raw tenths-of-unit integers (TMAX=256 = 25.6°C). Strongly recommended: pass metric or standard to get human-readable scaled values.')`
  - `includemetadata?: boolean (default true)`
  - `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ date, datatype, station, value, attributes }>, metadata?: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'date_range_exceeded', code: InvalidParams, when: 'Date range exceeds 1 year for sub-daily/daily/radar datasets (GHCND, PRECIP_*, NORMAL_DLY, NORMAL_HLY, NEXRAD2, NEXRAD3) or 10 years for monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN)' }`, `{ reason: 'validation_error', code: ValidationError, when: 'Bad dataset ID, date format, or unknown station/location ID' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: true`

---

## Design Decisions

**1. `noaa_climate_list_location_categories` is a first-class discovery tool.**
`/locationcategories` returns 12 stable ID/name pairs. Keeping them in the `noaa_climate_find_locations` parameter prose alone let one — `US_TERR` — go missing, and left the hydrological categories buried in a sentence rather than reachable by a call. The tool takes pagination and sort only: CDO ignores `datasetid`, `locationid`, `stationid`, and the date range on this endpoint, so offering those filters would advertise narrowing that never happens.

**2. `noaa_climate_find_locations` has `openWorldHint: true`, discovery tools have `false`.**
Datasets, categories, and data types are small, bounded, stable lists (the full universe fits in one or two pages). Locations — cities, counties, zip codes — are a large open corpus. `openWorldHint` accurately communicates this to clients.

**3. `noaa_climate_fetch_data` returns flat records, not pivoted tables.**
The CDO API returns `{ date, datatype, station, value }` tuples, not wide rows per date. Preserving this shape avoids fabricating a schema that doesn't match the data. The agent can pivot as needed. Pivoting in the server would also require knowing all the data types in advance, which creates coupling.

**4. Rate limit handling in the service layer, not in tools.**
The 5 req/s limit is best managed at the HTTP client level (token-bucket or retry-after backoff), not distributed across seven tool handlers. `CdoService` owns this concern.

**5. No workflow tool for "find stations and fetch data" composite.**
The primary workflow (find location → find stations → fetch data) is simple enough for agents to execute step-by-step with three tool calls. The intermediate state (location IDs, station IDs) is naturally captured by the agent. A composite workflow tool would save a round-trip but at the cost of a bloated, hard-to-test tool with many conditional parameters. Keep tools focused.

**6. Resources are supplementary only.**
`noaa://datasets` provides injectable context for clients that support resources, covering the small stable dataset list. `noaa://stations/{stationId}` mirrors `noaa_climate_get_station`. Both are optional — tools cover the same data.

**7. No prompt templates.**
This is a data-access server. The interaction patterns are "query → result", not structured workflows that benefit from templates.

**8. `noaa_climate_fetch_data` accepts arrays for `stationId` and `locationId`.**
The CDO API supports comma-separated or chained IDs for filtering. Accepting arrays on the MCP side and serializing them to the API's expected format is more ergonomic for agents. Common workflow: search returns several stations, agent passes all of them to fetch_data to get comparative readings.

---

## Known Limitations

- **No geocoding.** The CDO API has no lat/lon-to-location-name lookup. Agents that start with a place name must either know the location ID (e.g., FIPS code) or use `noaa_climate_find_locations` to search by name within a category.
- **No upstream text search on locations.** The `/locations` endpoint has no name-search or substring-filter parameter — only `sortfield=name` for alphabetical ordering. `noaa_climate_find_locations` synthesizes one client-side via `nameContains`: it enumerates the requested category (up to four `limit=1000` fetches, the largest burst that fits inside CDO's 5-requests-per-second limit) and substring-matches the names, which covers every category of at most 4,000 locations — every one but `ZIP` (30,415). Past the limit, narrow with `datasetId`/`datacategoryId`, page alphabetically, or use a known location ID format (e.g., `FIPS:37` for NC). Station search by `locationId` still requires an exact location ID — there is no name-based station lookup.
- **Date range limits.** Sub-daily, daily, and radar datasets are limited to 1-year per request; monthly/annual to 10 years. Multi-year daily analyses require sequential requests — each consuming daily quota.
- **10,000 requests/day ceiling.** Bulk historical analysis across many stations and long date ranges will hit the daily limit. Agents should prefer monthly (GSOM) or annual (GSOY) datasets when fine-grained daily data isn't needed.
- **Raw units by default.** Without `units=metric` or `units=standard`, GHCND returns unscaled integer values (TMAX=256 = raw tenths-of-degrees-C, i.e., 25.6°C). GSOM/GSOY values are already scaled. Always recommend passing a `units` parameter so agents don't receive raw tenths-of-unit integers they must interpret manually. The `format()` function should annotate the unit system actually applied.
- **Climate normals are date-range-fixed.** NORMAL_DLY/MLY/ANN/HLY normals are the 1981–2010 climatological normals. Despite spanning 30 years of source data, they are accessed with `startdate=2010-01-01` and `enddate=2010-12-31` — the API uses 2010 as the proxy year for all normals queries. This is an API convention, not a bug.

---

## API Reference

### Base URL
`https://www.ncei.noaa.gov/cdo-web/api/v2/`

### Auth
Header: `token: <NOAA_CDO_TOKEN>`

### Rate Limits
- 5 requests/second
- 10,000 requests/day

### Pagination
- `limit`: max results per page, up to 1000 (default 25)
- `offset`: record index to start from (0-based)
- Response includes `metadata.resultset.{ count, limit, offset }` when `includemetadata=true`

### Date Range Constraints (data endpoint)
| Dataset type | Max range per request |
|:-------------|:----------------------|
| Sub-daily, daily, and radar (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY, NEXRAD2, NEXRAD3) | 1 year |
| Monthly/Annual (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) | 10 years |

### Common Location ID Formats
| Format | Example | Meaning |
|:-------|:--------|:--------|
| `FIPS:{2-digit}` | `FIPS:37` | US state (FIPS code) |
| `FIPS:{5-digit}` | `FIPS:37021` | US county |
| `CITY:{id}` | `CITY:US530018` | City |
| `ZIP:{5-digit}` | `ZIP:98101` | US zip code |
| `FIPS:{2-letter}` | `FIPS:US` | Country (the `CNTRY` category, but IDs carry the `FIPS:` prefix) |
| `CLIM_REG:{id}` | `CLIM_REG:SOUTHATL` | NOAA climate region |

### Common Station ID Formats
| Format | Example | Notes |
|:-------|:--------|:------|
| `GHCND:{id}` | `GHCND:USW00024233` | GHCND stations (most common for daily data) |
| `COOP:{id}` | `COOP:010008` | NOAA Cooperative Observer network |

---

## Decisions Log

| Date | Decision | Rationale |
|:-----|:---------|:----------|
| 2026-05-23 | Single `CdoService` for all endpoints | All seven CDO endpoints share the same base URL, auth header, and pagination pattern. No benefit to splitting by endpoint. |
| 2026-05-23 | No `/locationcategories` tool | Only ~11 stable values; documenting them in the `noaa_climate_find_locations` description is sufficient. A dedicated tool would be called once and forgotten. |
| 2026-05-23 | Flat tuple output from `noaa_climate_fetch_data` | Preserves the CDO API's native response shape. Pivoting to wide-format would require knowing all requested data types upfront and introduces transformation errors. |
| 2026-05-23 | No composite station-search-and-fetch workflow tool | Three focused tools map to a simple three-step agent workflow. Combining them creates a bloated interface and moves error handling complexity into the tool. |
| 2026-05-23 | `openWorldHint: false` for reference/discovery tools | Datasets, categories, and data types are finite, enumerable lists the server can fully return. `openWorldHint: true` reserved for locations and stations (effectively unbounded). |
| 2026-05-23 | Arrays accepted for `stationId`/`locationId` in fetch_data | CDO API supports multiple IDs natively. Accepting arrays avoids forcing agents to loop and accumulate results manually — key for comparing readings across stations. |
| 2026-05-23 | Rate-limit handling owned by `CdoService` | Centralizing retry/backoff in the HTTP client prevents duplicating logic across seven tool handlers and ensures consistent behavior. |
| 2026-05-23 | Corrected rate limit: 10,000/day (not 1,000) | The official CDO API docs state 10,000 requests/day. The idea.md noted 1,000, which appears to be an older or incorrect figure. API docs are authoritative. |
| 2026-05-23 | Corrected list response shape: `results` key, not endpoint-named keys | Official CDO API returns `{"results": [...], "metadata": {"resultset": {"limit","count","offset"}}}`. All collection output schemas updated. |
| 2026-05-23 | Added NORMAL_HLY dataset | Exists as a full CDO dataset (hourly normals) omitted from initial design. |
| 2026-05-23 | Corrected date range limits for NORMAL_DLY/HLY | API classifies by temporal resolution, not dataset name. NORMAL_DLY and NORMAL_HLY follow the 1-year daily rule; NORMAL_MLY/ANN follow the 10-year monthly/annual rule. |
| 2026-08-18 | Reversed the 2026-05-23 "No `/locationcategories` tool" decision | The live endpoint returns 12 categories, not the ~11 the original entry assumed — the parameter prose omitted `US_TERR` entirely. The hydrological categories are also the entry point practitioners need, and `nameContains` makes picking a bounded category a real decision. `noaa_climate_list_location_categories` now enumerates them. |
| 2026-08-18 | `nameContains` eligibility is a live count, never a category allowlist | `HYD_CAT` (2,111) is larger than `CITY` (1,989), so any hardcoded "small categories" list gets it wrong, and a category can grow across the line. The handler reads `metadata.resultset.count` from its own first enumeration fetch and rejects past four `limit=1000` pages — four being the largest burst inside CDO's 5-requests-per-second limit, and 4,000 landing in the 9.6x gap between `CNTY` (3,178) and `ZIP` (30,415). |
| 2026-08-18 | `nameContains` enumerates fully, then filters, and synthesizes its own `metadata.resultset` | Filtering one upstream page would leave `totalCount` describing the raw category while the results describe the filtered set. Relaying CDO's raw echo reproduces the same lie in `metadata` and `format()`, since it describes an internal fetch the caller never made. |
| 2026-08-18 | Date-range cap follows CDO's month rule, not a fixed day count | Probing `/data` live: a request is accepted while `endDate` is on or before the last day of the calendar month N years after `startDate`'s month. The old 365/3650-day caps rejected a full leap year (366 days) and a full 10 calendar years (3,652 days) that CDO answers normally. |
| 2026-08-18 | Date filters go on the wire in the canonical `YYYY-MM-DD[THH:MM:SS]` form, not the caller's string | CDO's parsers disagree with each other: `/data` rejects a compact `startdate` — with the misleading "The date range must be less than 1 year." — and rejects the unpadded dashed form outright, while every other endpoint accepts both. Normalizing at the edge keeps one schema across the whole surface *and* makes every advertised form work everywhere, which passing the caller's string through did not. |
| 2026-08-18 | `NEXRAD2`/`NEXRAD3` carry the 1-year cap | CDO documents the cap for daily datasets only, yet enforces the same calendar-month boundary on radar: from a 2020-03-10 start, 2021-04-01 answers "The date range must be less than 1 year." while 2021-03-31 gets past the range check. Uncapped, an over-long radar request was forwarded and the caller got that opaque upstream error in place of `date_range_exceeded` and its computed `maxEndDate`. |
| 2026-08-18 | Example station ID is `GHCND:USW00024233` | `GHCND:USC00450974` never resolved — CDO answers it with a bare `{}` — so an agent following the example landed on `not_found`. Replacements are verified against the live API before landing. |
| 2026-05-23 | Added typed error contracts to all tools | Structured `{ reason, code, when, retryable }` format required for `ctx.fail` type-checking. |
| 2026-05-23 | Documented camelCase→lowercase param translation responsibility | CDO API requires lowercase param names; MCP input schemas use camelCase. CdoService owns the translation. |
