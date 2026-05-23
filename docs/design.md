# noaa-cdo-mcp-server — Design

## MCP Surface

### Tools

| Name | Description | Key Inputs | Annotations |
|:-----|:------------|:-----------|:------------|
| `noaa_list_datasets` | List available NOAA CDO datasets, optionally filtered by data type, location, station, or date range. Returns dataset IDs, names, and temporal coverage. | `datatypeId[]?`, `locationId?`, `startDate?`, `endDate?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_list_data_types` | List available data types (TMAX, TMIN, PRCP, SNOW, etc.), optionally filtered by dataset, data category, location, or station. Use to discover what measurements are available before querying data. | `datasetId?`, `datacategoryId?`, `locationId?`, `stationId?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_list_data_categories` | List data categories (Temperature, Precipitation, Wind, etc.) that group related data types. Optionally filter by dataset, location, or station. | `datasetId?`, `locationId?`, `stationId?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_find_locations` | Search for locations by category (country, state, county, city, zip, climate region). Optionally filter by dataset, data category, and date range. Use to discover location IDs for narrowing station and data queries. | `locationCategoryId?`, `datasetId?`, `datacategoryId?`, `startDate?`, `endDate?`, `sortField?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: true` |
| `noaa_find_stations` | Search for weather stations by location, bounding box, dataset, data type, and date range. Returns station IDs, names, coordinates, and data coverage metadata. | `locationId?`, `extent?`, `datasetId?`, `datatypeId?`, `datacategoryId?`, `startDate?`, `endDate?`, `sortField?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: true` |
| `noaa_get_station` | Fetch full metadata for a single station by ID, including name, coordinates, elevation, and data coverage dates. | `stationId` | `readOnlyHint: true`, `openWorldHint: false` |
| `noaa_fetch_data` | Fetch historical observation data for a dataset, date range, and one or more stations or locations. Returns time-series values for the requested data types. | `datasetId`, `startDate`, `endDate`, `stationId[]?`, `locationId[]?`, `datatypeId[]?`, `units?`, `limit`, `offset` | `readOnlyHint: true`, `openWorldHint: true` |

### Resources

| URI Template | Description | Pagination |
|:-------------|:------------|:-----------|
| `noaa://datasets` | All available CDO datasets with IDs, names, and temporal coverage. | Stable small list (11–13 datasets via the API) — no pagination needed |
| `noaa://stations/{stationId}` | Station metadata by ID (name, coordinates, elevation, data coverage). | n/a |

### Prompts

None. This is a data-access server; no recurring interaction templates are warranted.

---

## Overview

`noaa-cdo-mcp-server` exposes NOAA's Climate Data Online (CDO) API v2 to LLM agents. It provides access to historical weather observations, climate summaries, and station metadata going back centuries. The primary use case is answering questions like "what's the historical climate at location X?" or "what were the temperatures and precipitation at station Y between these dates?"

It complements the `nws-weather-mcp-server` (real-time forecasts and alerts) by providing the historical record — together they form a complete weather data stack for agents.

The API wraps `https://www.ncei.noaa.gov/cdo-web/api/v2/`.

## Requirements

- Read-only access to NOAA CDO API v2
- API token required (free registration at ncdc.noaa.gov/cdo-web/token; token passed as `token` request header)
- Rate limits: 5 requests/second, 10,000 requests/day per token
- Seven endpoints exposed: datasets, datacategories, datatypes, locationcategories, locations, stations, data
- Date range constraints: sub-daily and daily data (GHCND, PRECIP_*, NORMAL_DLY, NORMAL_HLY) limited to 1-year ranges per request; monthly/annual data (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) limited to 10-year ranges
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
3. `noaa_list_datasets`, `noaa_list_data_categories`, `noaa_list_data_types` — reference/discovery tools (simplest; no required params)
4. `noaa_find_locations` — location search (required for navigation workflows)
5. `noaa_find_stations`, `noaa_get_station` — station discovery and lookup
6. `noaa_fetch_data` — observation data retrieval (most complex; requires all prior pieces)
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
| Location category | `/locationcategories` | `CITY`, `CLIM_DIV`, `CLIM_REG`, `CNTRY`, `CNTY`, `HYD_ACC`, `HYD_CAT`, `HYD_REG`, `HYD_SUB`, `ST`, `ZIP` | ~11 categories; hierarchical geography |
| Location | `/locations` or `/locations/{id}` | `FIPS:37` (state), `CITY:US390029`, `ZIP:28801`, `CNTRY:US` | Filtered by `locationcategoryid` |
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
| 1 | `noaa_find_locations` | Find a location ID for a city, state, or zip — e.g., `CITY:US530031` for Seattle |
| 2 | `noaa_find_stations` | Find stations within that location that support the desired dataset and data types |
| 3 | `noaa_fetch_data` | Fetch observations for chosen stations over the desired date range |

### Discovery workflow: what's available?

When the agent doesn't know what data exists:

| Step | Tool | What it does |
|:-----|:-----|:-------------|
| 1 | `noaa_list_datasets` | See all available datasets and their temporal coverage |
| 2 | `noaa_list_data_categories` | Browse measurement groups (Temperature, Precipitation, etc.) |
| 3 | `noaa_list_data_types` | Get specific measurement IDs (TMAX, PRCP, etc.) for the chosen dataset |

### Climate profile workflow

"What's the typical climate in X?" — uses climate normals:

| Step | Tool | What it does |
|:-----|:-----|:-------------|
| 1 | `noaa_find_stations` | Find stations with `datasetId=NORMAL_DLY` near the location |
| 2 | `noaa_fetch_data` | Query `NORMAL_DLY` with `startDate=2010-01-01`, `endDate=2010-12-31` for the full normal year |

Use `NORMAL_HLY` (hourly) or `NORMAL_MLY` (monthly) for coarser granularity. All normals datasets use the same 2010-proxy date range.

---

## Tool Detail

### `noaa_list_datasets`

- **Description**: List available NOAA CDO datasets with their IDs, names, and temporal coverage. Returns all ~11 datasets by default (no required params). Optionally filter to datasets that contain a specific data type, cover a location or station, or overlap a date range.
- **Input**: `datatypeId?: string[]`, `locationId?: string`, `stationId?: string`, `startDate?: string` (ISO), `endDate?: string` (ISO), `sortField?: enum('id'|'name'|'mindate'|'maxdate'|'datacoverage')`, `sortOrder?: enum('asc'|'desc')`, `limit: number (default 25, max 1000)`, `offset: number (default 0)`
- **Output**: `{ results: Array<{ id, name, datacoverage, mindate, maxdate }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'invalid_params', code: InvalidParams, when: 'Bad date format or unknown ID' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_list_data_categories`

- **Description**: List data categories that group related data types — Temperature, Precipitation, Wind, etc. Use to discover what types of measurements are available before calling `noaa_list_data_types`. Optionally filter by dataset, location, station, or date range.
- **Input**: `datasetId?: string`, `locationId?: string`, `stationId?: string`, `startDate?: string`, `endDate?: string`, `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ id, name }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_list_data_types`

- **Description**: List available data types (measurement labels like TMAX, TMIN, PRCP, SNOW) for a given dataset or category. Pass a `datasetId` to see what's measured in that dataset, or a `datacategoryId` (e.g., `TEMP`) to see all temperature-related types. Required before querying data when the data type IDs are unknown.
- **Input**: `datasetId?: string`, `datacategoryId?: string`, `locationId?: string`, `stationId?: string`, `startDate?: string`, `endDate?: string`, `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ id, name, datacoverage, mindate, maxdate }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_find_locations`

- **Description**: Search for geographic locations by category (CITY, ST, CNTY, CNTRY, ZIP, CLIM_REG, etc.). Returns location IDs used in station search and data queries. Without `locationCategoryId`, returns all location types. Use `locationCategoryId=ST` to list US states (small set, ~52), `locationCategoryId=CITY` for cities (large set — thousands of pages at default limit). The API has no name-search parameter; to find a specific city, sort alphabetically with `sortField=name` and page through results. Location IDs follow formats like `FIPS:37` (state), `CITY:US530031` (city), `ZIP:98101`.
- **Input**: `locationCategoryId?: string` (e.g., `ST`, `CITY`, `CNTY`, `CNTRY`, `ZIP`, `CLIM_REG`) — `.describe('Category filter. Use ST for states (~52 entries), CNTY for counties, CITY for cities (large set, thousands of entries), CNTRY for countries, ZIP for zip codes, CLIM_REG for NOAA climate regions.')`, `datasetId?: string`, `datacategoryId?: string`, `startDate?: string`, `endDate?: string`, `sortField?: enum('id'|'name'|'mindate'|'maxdate'|'datacoverage')`, `sortOrder?: enum('asc'|'desc')`, `limit: number (default 25, max 1000)`, `offset: number (default 0)`
- **Output**: `{ results: Array<{ id, name, datacoverage, mindate, maxdate }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'no_results', code: NotFound, when: 'Valid query but no locations match the filters' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: true`

### `noaa_find_stations`

- **Description**: Search for weather observation stations by location, bounding box, dataset, and data type. Returns station IDs, names, coordinates, elevation, and data coverage dates. Filters by `locationId` (e.g., `FIPS:37` for NC), `extent` (lat/lon bounding box as `"minLat,minLon,maxLat,maxLon"`), `datasetId`, `datatypeId`, and date range. Station IDs returned here are used as `stationId` in `noaa_fetch_data`.
- **Input**: `locationId?: string`, `extent?: string` (e.g., `"47.5,-122.4,47.7,-122.1"`), `datasetId?: string`, `datatypeId?: string[]`, `datacategoryId?: string`, `startDate?: string`, `endDate?: string`, `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ id, name, latitude, longitude, elevation, mindate, maxdate, datacoverage }>, metadata: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'no_results', code: NotFound, when: 'Valid query but no stations match the filters' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: true`

### `noaa_get_station`

- **Description**: Fetch full metadata for a single weather station by its ID (e.g., `GHCND:USC00450974`, `COOP:010008`). Returns name, coordinates, elevation, and the full date range for which data is available. Use when you have a station ID from `noaa_find_stations` and want its details.
- **Input**: `stationId: string` (e.g., `GHCND:USC00450974`)
- **Output**: `{ id, name, latitude, longitude, elevation, mindate, maxdate, datacoverage }`
- **Errors**: `{ reason: 'not_found', code: NotFound, when: 'Station ID format is valid but no station exists with that ID' }`, `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: false`

### `noaa_fetch_data`

- **Description**: Fetch historical observation records from a NOAA CDO dataset for a given date range. Requires a `datasetId` (e.g., `GHCND` for daily, `GSOM` for monthly), `startDate`, and `endDate`. Optionally scope to specific stations, locations, and data types. Sub-daily and daily data (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY) is limited to a 1-year date range per request; monthly and annual data (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) is limited to 10 years. Returns a flat array of `{ date, datatype, station, value, attributes }` records. Specify `units=metric` or `units=standard` to scale values; without a `units` parameter, raw unscaled values are returned — for GHCND, temperatures are in tenths of degrees and precipitation in tenths of mm (e.g., raw TMAX=256 → 25.6°C with `units=metric`; raw PRCP=12 → 1.2mm).
- **Input**:
  - `datasetId: string` — `.describe('Dataset ID (e.g., GHCND for daily data, GSOM for monthly, GSOY for annual, NORMAL_DLY/MLY/ANN/HLY for 1981-2010 climate normals). Determines the date range limit: sub-daily and daily datasets (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY) allow 1-year max per request; monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) allow 10-year max.')` 
  - `startDate: string` (ISO date `YYYY-MM-DD`) — `.describe('Start date for observations. For NORMAL_* datasets use 2010-01-01 regardless of the years being analyzed.')`
  - `endDate: string` (ISO date `YYYY-MM-DD`) — `.describe('End date for observations. Must be within 1 year of startDate for sub-daily/daily datasets (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY) or within 10 years for monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN). For any NORMAL_* dataset use 2010-12-31.')`
  - `stationId?: string[]` — `.describe('One or more station IDs to filter by (e.g., ["GHCND:USC00450974"]). Obtain from noaa_find_stations. Serialized to ampersand-chained query params.')`
  - `locationId?: string[]` — `.describe('One or more location IDs to filter by (e.g., ["FIPS:37", "ZIP:98101"]). Broader than stationId — returns all data within the location.')`
  - `datatypeId?: string[]` — `.describe('One or more data type IDs to include (e.g., ["TMAX","TMIN","PRCP"]). Without this, all data types for the dataset are returned. Use noaa_list_data_types to discover valid IDs.')`
  - `units?: enum('standard'|'metric')` — `.describe('Unit system for returned values. Without this, GHCND returns raw tenths-of-unit integers (TMAX=256 = 25.6°C). Strongly recommended: pass metric or standard to get human-readable scaled values.')`
  - `includemetadata?: boolean (default true)`
  - `sortField?`, `sortOrder?`, `limit`, `offset`
- **Output**: `{ results: Array<{ date, datatype, station, value, attributes }>, metadata?: { resultset: { count, limit, offset } } }`
- **Errors**: `{ reason: 'service_unavailable', code: ServiceUnavailable, when: 'CDO API is down or unreachable', retryable: true }`, `{ reason: 'date_range_exceeded', code: InvalidParams, when: 'Date range exceeds 1 year for sub-daily/daily datasets (GHCND, PRECIP_*, NORMAL_DLY, NORMAL_HLY) or 10 years for monthly/annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN)' }`, `{ reason: 'invalid_params', code: InvalidParams, when: 'Bad dataset ID, date format, or unknown station/location ID' }`, `{ reason: 'no_results', code: NotFound, when: 'Valid query but no observations exist for the given filters and date range' }`
- **Annotations**: `readOnlyHint: true`, `openWorldHint: true`

---

## Design Decisions

**1. No `noaa_list_location_categories` tool.**
The CDO API has a `/locationcategories` endpoint, but there are only ~11 categories (`CITY`, `ST`, `CNTY`, `CNTRY`, `ZIP`, etc.) and they're stable. Surfacing them as a discovery tool adds a call step without meaningful value — the categories are documented in the `noaa_find_locations` parameter description. Agents that need them can read the description; a separate tool would be dead weight.

**2. `noaa_find_locations` has `openWorldHint: true`, discovery tools have `false`.**
Datasets, categories, and data types are small, bounded, stable lists (the full universe fits in one or two pages). Locations — cities, counties, zip codes — are a large open corpus. `openWorldHint` accurately communicates this to clients.

**3. `noaa_fetch_data` returns flat records, not pivoted tables.**
The CDO API returns `{ date, datatype, station, value }` tuples, not wide rows per date. Preserving this shape avoids fabricating a schema that doesn't match the data. The agent can pivot as needed. Pivoting in the server would also require knowing all the data types in advance, which creates coupling.

**4. Rate limit handling in the service layer, not in tools.**
The 5 req/s limit is best managed at the HTTP client level (token-bucket or retry-after backoff), not distributed across seven tool handlers. `CdoService` owns this concern.

**5. No workflow tool for "find stations and fetch data" composite.**
The primary workflow (find location → find stations → fetch data) is simple enough for agents to execute step-by-step with three tool calls. The intermediate state (location IDs, station IDs) is naturally captured by the agent. A composite workflow tool would save a round-trip but at the cost of a bloated, hard-to-test tool with many conditional parameters. Keep tools focused.

**6. Resources are supplementary only.**
`noaa://datasets` provides injectable context for clients that support resources, covering the small stable dataset list. `noaa://stations/{stationId}` mirrors `noaa_get_station`. Both are optional — tools cover the same data.

**7. No prompt templates.**
This is a data-access server. The interaction patterns are "query → result", not structured workflows that benefit from templates.

**8. `noaa_fetch_data` accepts arrays for `stationId` and `locationId`.**
The CDO API supports comma-separated or chained IDs for filtering. Accepting arrays on the MCP side and serializing them to the API's expected format is more ergonomic for agents. Common workflow: search returns several stations, agent passes all of them to fetch_data to get comparative readings.

---

## Known Limitations

- **No geocoding.** The CDO API has no lat/lon-to-location-name lookup. Agents that start with a place name must either know the location ID (e.g., FIPS code) or use `noaa_find_locations` to search by name within a category.
- **No text search on locations.** The `/locations` endpoint has no name-search or substring-filter parameter — only `sortfield=name` for alphabetical ordering. Agents that need a city ID must fetch all cities with `locationCategoryId=CITY` (possibly multiple pages) and scan results for the target name, or use a known location ID format (e.g., `FIPS:37` for NC). Station search by `locationId` similarly requires an exact location ID — there is no name-based lookup.
- **Date range limits.** Sub-daily and daily datasets are limited to 1-year per request; monthly/annual to 10 years. Multi-year daily analyses require sequential requests — each consuming daily quota.
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
| Sub-daily and daily (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY) | 1 year |
| Monthly/Annual (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) | 10 years |

### Common Location ID Formats
| Format | Example | Meaning |
|:-------|:--------|:--------|
| `FIPS:{2-digit}` | `FIPS:37` | US state (FIPS code) |
| `FIPS:{5-digit}` | `FIPS:37021` | US county |
| `CITY:{id}` | `CITY:US530031` | City |
| `ZIP:{5-digit}` | `ZIP:98101` | US zip code |
| `CNTRY:{2-letter}` | `CNTRY:US` | Country |
| `CLIM_REG:{id}` | `CLIM_REG:SOUTHATL` | NOAA climate region |

### Common Station ID Formats
| Format | Example | Notes |
|:-------|:--------|:------|
| `GHCND:{id}` | `GHCND:USC00450974` | GHCND stations (most common for daily data) |
| `COOP:{id}` | `COOP:010008` | NOAA Cooperative Observer network |

---

## Decisions Log

| Date | Decision | Rationale |
|:-----|:---------|:----------|
| 2026-05-23 | Single `CdoService` for all endpoints | All seven CDO endpoints share the same base URL, auth header, and pagination pattern. No benefit to splitting by endpoint. |
| 2026-05-23 | No `/locationcategories` tool | Only ~11 stable values; documenting them in the `noaa_find_locations` description is sufficient. A dedicated tool would be called once and forgotten. |
| 2026-05-23 | Flat tuple output from `noaa_fetch_data` | Preserves the CDO API's native response shape. Pivoting to wide-format would require knowing all requested data types upfront and introduces transformation errors. |
| 2026-05-23 | No composite station-search-and-fetch workflow tool | Three focused tools map to a simple three-step agent workflow. Combining them creates a bloated interface and moves error handling complexity into the tool. |
| 2026-05-23 | `openWorldHint: false` for reference/discovery tools | Datasets, categories, and data types are finite, enumerable lists the server can fully return. `openWorldHint: true` reserved for locations and stations (effectively unbounded). |
| 2026-05-23 | Arrays accepted for `stationId`/`locationId` in fetch_data | CDO API supports multiple IDs natively. Accepting arrays avoids forcing agents to loop and accumulate results manually — key for comparing readings across stations. |
| 2026-05-23 | Rate-limit handling owned by `CdoService` | Centralizing retry/backoff in the HTTP client prevents duplicating logic across seven tool handlers and ensures consistent behavior. |
| 2026-05-23 | Corrected rate limit: 10,000/day (not 1,000) | The official CDO API docs state 10,000 requests/day. The idea.md noted 1,000, which appears to be an older or incorrect figure. API docs are authoritative. |
| 2026-05-23 | Corrected list response shape: `results` key, not endpoint-named keys | Official CDO API returns `{"results": [...], "metadata": {"resultset": {"limit","count","offset"}}}`. All collection output schemas updated. |
| 2026-05-23 | Added NORMAL_HLY dataset | Exists as a full CDO dataset (hourly normals) omitted from initial design. |
| 2026-05-23 | Corrected date range limits for NORMAL_DLY/HLY | API classifies by temporal resolution, not dataset name. NORMAL_DLY and NORMAL_HLY follow the 1-year daily rule; NORMAL_MLY/ANN follow the 10-year monthly/annual rule. |
| 2026-05-23 | Added typed error contracts to all tools | Structured `{ reason, code, when, retryable }` format required for `ctx.fail` type-checking. |
| 2026-05-23 | Documented camelCase→lowercase param translation responsibility | CDO API requires lowercase param names; MCP input schemas use camelCase. CdoService owns the translation. |
