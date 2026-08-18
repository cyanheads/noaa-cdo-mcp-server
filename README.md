<div align="center">
  <h1>@cyanheads/noaa-climate-mcp-server</h1>
  <p><b>Search NOAA climate stations and datasets, fetch historical weather observations via MCP. STDIO or Streamable HTTP.</b>
  <div>9 Tools • 2 Resources</div>
  </p>
</div>

<div align="center">

[![Version](https://img.shields.io/badge/Version-0.5.0-blue.svg?style=flat-square)](./CHANGELOG.md) [![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg?style=flat-square)](./LICENSE) [![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/users/cyanheads/packages/container/package/noaa-climate-mcp-server) [![MCP SDK](https://img.shields.io/badge/MCP%20SDK-^1.30.0-green.svg?style=flat-square)](https://modelcontextprotocol.io/) [![npm](https://img.shields.io/npm/v/@cyanheads/noaa-climate-mcp-server?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@cyanheads/noaa-climate-mcp-server) [![TypeScript](https://img.shields.io/badge/TypeScript-^7.0.2-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Bun-v1.3.0-blueviolet.svg?style=flat-square)](https://bun.sh/)

</div>

<div align="center">

[![Install in Claude Desktop](https://img.shields.io/badge/Install_in-Claude_Desktop-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://github.com/cyanheads/noaa-climate-mcp-server/releases/latest/download/noaa-climate-mcp-server.mcpb) [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=noaa-climate-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBjeWFuaGVhZHMvbm9hYS1jbGltYXRlLW1jcC1zZXJ2ZXIiXSwiZW52Ijp7Ik5PQUFfQ0RPX1RPS0VOIjoieW91ci10b2tlbi1oZXJlIn19) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22noaa-climate-mcp-server%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40cyanheads%2Fnoaa-climate-mcp-server%22%5D%2C%22env%22%3A%7B%22NOAA_CDO_TOKEN%22%3A%22your-token-here%22%7D%7D)

[![Framework](https://img.shields.io/badge/Built%20on-@cyanheads/mcp--ts--core-67E8F9?style=flat-square)](https://www.npmjs.com/package/@cyanheads/mcp-ts-core)

</div>

<div align="center">

**Public Hosted Server:** [https://noaa-climate.caseyjhand.com/mcp](https://noaa-climate.caseyjhand.com/mcp)

</div>

---

## Tools

9 tools — 8 over the NOAA Climate Data Online (CDO) API v2, plus severe-weather event search over the NCEI Storm Events Database:

| Tool | Description |
|:---|:---|
| `noaa_climate_list_datasets` | List available CDO datasets with IDs, names, and temporal coverage |
| `noaa_climate_list_data_categories` | List data category groups (Temperature, Precipitation, Wind, etc.) |
| `noaa_climate_list_data_types` | List specific measurement labels (TMAX, TMIN, PRCP, SNOW, etc.) by dataset or category |
| `noaa_climate_list_location_categories` | List the 12 location categories that scope location search |
| `noaa_climate_find_locations` | Search geographic locations by category (states, cities, counties, zip codes, climate regions), with an optional name filter |
| `noaa_climate_find_stations` | Search weather stations by location, bounding box, dataset, and data type |
| `noaa_climate_get_station` | Fetch full metadata for a single station by ID |
| `noaa_climate_fetch_data` | Fetch historical observation records for a dataset and date range |
| `noaa_climate_search_storm_events` | Search the NCEI Storm Events Database for one year — tornadoes, hail, floods, hurricanes, with damage, casualties, and narratives |

### `noaa_climate_list_datasets`

List all available NOAA CDO datasets — approximately 11 in total.

- Returns dataset IDs, names, data coverage fraction, and temporal range
- No required parameters — returns everything by default
- Optionally filter by data type, location, station, or date range
- Common datasets: GHCND (daily, 1763–present), GSOM (monthly), GSOY (annual), NORMAL_DLY/MLY/ANN/HLY (1981–2010 climate normals)
- Start here to orient before calling `noaa_climate_fetch_data`

---

### `noaa_climate_list_data_categories`

List data category groups that organize related measurement types.

- ~41 categories including Temperature, Precipitation, Wind, Pressure, Sunshine, Sky cover, Weather Type
- Optionally filter by dataset, location, station, or date range
- Use before `noaa_climate_list_data_types` to narrow by measurement domain

---

### `noaa_climate_list_data_types`

List specific measurement labels for a dataset or category.

- Hundreds of data types across all datasets
- Filter by dataset (e.g., `GHCND`) or category (e.g., `TEMP`) to narrow results
- Common GHCND types: `TMAX` (max temperature), `TMIN` (min temperature), `PRCP` (precipitation), `SNOW` (snowfall), `SNWD` (snow depth), `AWND` (average wind speed)
- Returns ID, name, coverage fraction, and date range per type

---

### `noaa_climate_list_location_categories`

List the location categories that scope `noaa_climate_find_locations` — 12 in total.

- Returns category IDs (`CITY`, `ST`, `CNTY`, `CNTRY`, `ZIP`, `US_TERR`, `CLIM_REG`, `CLIM_DIV`, `HYD_ACC`, `HYD_CAT`, `HYD_REG`, `HYD_SUB`) and their names
- Call it when you do not know which `locationCategoryId` to pass
- Pagination and sort only — the CDO endpoint ignores dataset, location, station, and date filters, so none are offered

---

### `noaa_climate_find_locations`

Search geographic locations by category.

- Category types: `ST` (US states, 51), `CNTY` (counties), `CITY` (cities), `CNTRY` (countries), `ZIP` (zip codes), `US_TERR` (US territories), `CLIM_REG` (NOAA climate regions), `CLIM_DIV` (climate divisions), hydrological categories — `noaa_climate_list_location_categories` returns the authoritative set
- Use `locationCategoryId=ST` to list all states in one call
- `nameContains` gives the name search the CDO API lacks: the server enumerates the requested category and matches the substring case-insensitively, so `locationCategoryId=CITY` with `nameContains=seattle` resolves a city in one call. It is a size rule, not a category list — the category must hold at most 4,000 locations, which is every category but `ZIP` (30,415), and a `datasetId` or `datacategoryId` filter can bring a larger one back under the limit. Past it, page alphabetically with `sortField=name`
- Returns location IDs (`FIPS:37`, `CITY:US530018`, `ZIP:98101`) used in station search and data queries

---

### `noaa_climate_find_stations`

Search weather observation stations.

- Filter by location ID, bounding box (lat/lon), dataset, data type, and date range
- Returns station IDs, names, coordinates, elevation, and data coverage dates
- A station must have data for the dataset and date range you want — pass `datasetId` and date range to ensure compatibility
- Common station ID formats: `GHCND:USW00024233`, `COOP:010008`
- Station IDs returned here feed directly into `noaa_climate_fetch_data`

---

### `noaa_climate_get_station`

Fetch full metadata for a single weather station by ID.

- Returns name, coordinates (decimal degrees), elevation, and full data coverage date range
- Use to verify a station before querying data, or to check its temporal coverage
- Mirrors the `noaa://stations/{stationId}` resource as a direct lookup

---

### `noaa_climate_fetch_data`

Fetch historical observation records from a NOAA CDO dataset.

- Requires `datasetId`, `startDate`, and `endDate`; optionally scoped by station, location, and data type
- **Date range limits:** sub-daily, daily, and radar datasets (GHCND, PRECIP_15, PRECIP_HLY, NORMAL_DLY, NORMAL_HLY, NEXRAD2, NEXRAD3) — 1 year max per request; monthly and annual datasets (GSOM, GSOY, NORMAL_MLY, NORMAL_ANN) — 10 years max
- **Unit selection:** strongly recommended — pass `units=metric` (SI) or `units=standard` (Fahrenheit/inches). Without it, GHCND values are raw tenths-of-unit integers (TMAX=256 = 25.6°C, PRCP=12 = 1.2mm); GSOM/GSOY are already scaled
- **Climate normals:** for any NORMAL_* dataset, use `startDate=2010-01-01` and `endDate=2010-12-31` — that is the API proxy year regardless of which 30-year period is described
- Returns flat tuples of `{ date, datatype, station, value, attributes }` with pagination metadata

---

### `noaa_climate_search_storm_events`

Search the NCEI Storm Events Database — a different NOAA corpus from the CDO tools above.

- Discrete severe-weather events (tornado, hail, flood, hurricane, winter storm, heat, and every other NWS Storm Data type) rather than station observations, back to 1950
- Returns event type, state and county/zone, begin and end times, magnitude, tornado F/EF scale with track length and width, direct and indirect deaths and injuries, property and crop damage, and the episode and event narratives
- **No token required** — this corpus is published as bulk CSV, not through CDO, so `NOAA_CDO_TOKEN` is irrelevant to this tool
- **`year` is required.** NCEI publishes one gzip file per year (~12 MB, ~70k events for a recent year), so an unscoped search would download every year back to 1950
- **`state` takes the full name NCEI writes** — `"FLORIDA"`, not `"FL"`. `eventType` is matched case-insensitively against the exact NWS label (`"Tornado"`, `"Flash Flood"`, `"Hurricane (Typhoon)"`); a miss comes back with the labels that year actually contains
- **Damage is honest about what NCEI reported.** Values arrive as magnitude-suffixed strings (`"75.00K"`, `"1.20M"`, `"1.00B"`) and are returned as both the raw cell and a parsed dollar amount. An unreported figure — about a fifth of a recent year — is omitted entirely rather than reported as `0`, so it can never be read as confirmed zero damage. `minDamageInUsd` therefore excludes those rows and reports how many it dropped
- **Filenames are discovered, never constructed.** Each year's file carries a publish-date suffix that changes when NCEI republishes it, so the tool reads the directory index every time its cache lapses
- The server caches two years of compressed bytes for six hours — under 30 MB, since a bundle runs 12 MB for a recent year and 15 MB for the largest (2011). Each search streams the decompression, so the ~70 MB decompressed form is never materialized. That bounds what is *retained*, not peak memory: the transient chunks still cost headroom, and a cold full-year 2024 scan measured 129 MB RSS at baseline against a 269 MB peak

---

## Resources

| Type | Name | Description |
|:---|:---|:---|
| Resource | `noaa://datasets` | All CDO datasets with IDs and temporal coverage — injectable context for orienting an agent before querying data |
| Resource | `noaa://stations/{stationId}` | Station metadata by ID — name, coordinates, elevation, and data coverage date range |

## Features

Built on [`@cyanheads/mcp-ts-core`](https://github.com/cyanheads/mcp-ts-core):

- Declarative tool definitions — single file per tool, framework handles registration and validation
- Unified error handling across all tools
- Pluggable auth (`none`, `jwt`, `oauth`)
- Swappable storage backends: `in-memory`, `filesystem`, `Supabase`, `Cloudflare KV/R2/D1`
- Structured logging with optional OpenTelemetry tracing
- Runs locally (stdio/HTTP) or on Cloudflare Workers from the same codebase

NOAA CDO-specific:

- Full CDO API v2 coverage — datasets, data categories, data types, locations, stations, and observations
- Client-side date range validation with per-dataset limits enforced before hitting the API
- Unit normalization via the CDO `units` parameter — avoids raw tenths-of-unit integer confusion
- Retry with exponential backoff for transient API failures

Agent-friendly output:

- Paginated results across all list and search tools — `limit`, `offset`, and total count in every response
- Station and dataset IDs flow naturally between tools — find a location, find stations in it, fetch data from those stations
- Structured error contracts with `reason` codes and recovery hints — agents can branch on data, not string parsing
- Dataset and station resources for injectable, zero-fetch context

## Getting started

### Self-Hosted / Local

Add the following to your MCP client configuration file.

```json
{
  "mcpServers": {
    "noaa-climate-mcp-server": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@cyanheads/noaa-climate-mcp-server@latest"],
      "env": {
        "MCP_TRANSPORT_TYPE": "stdio",
        "MCP_LOG_LEVEL": "info",
        "NOAA_CDO_TOKEN": "your-token-here"
      }
    }
  }
}
```

Or with npx (no Bun required):

```json
{
  "mcpServers": {
    "noaa-climate-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cyanheads/noaa-climate-mcp-server@latest"],
      "env": {
        "MCP_TRANSPORT_TYPE": "stdio",
        "MCP_LOG_LEVEL": "info",
        "NOAA_CDO_TOKEN": "your-token-here"
      }
    }
  }
}
```

Or with Docker:

```json
{
  "mcpServers": {
    "noaa-climate-mcp-server": {
      "type": "stdio",
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "MCP_TRANSPORT_TYPE=stdio", "-e", "NOAA_CDO_TOKEN=your-token-here", "ghcr.io/cyanheads/noaa-climate-mcp-server:latest"]
    }
  }
}
```

For Streamable HTTP, set the transport and start the server:

```sh
MCP_TRANSPORT_TYPE=http MCP_HTTP_PORT=3010 NOAA_CDO_TOKEN=your-token-here bun run start:http
# Server listens at http://localhost:3010/mcp
```

### Prerequisites

- [Bun v1.3.0](https://bun.sh/) or higher (or Node.js ≥24.0.0).
- A free [NOAA CDO API token](https://www.ncdc.noaa.gov/cdo-web/token) — required for all requests.

### Installation

1. **Clone the repository:**

```sh
git clone https://github.com/cyanheads/noaa-climate-mcp-server.git
```

2. **Navigate into the directory:**

```sh
cd noaa-climate-mcp-server
```

3. **Install dependencies:**

```sh
bun install
```

## Configuration

All configuration is validated at startup via Zod schemas in `src/config/server-config.ts`. Key environment variables:

| Variable | Description | Default |
|:---|:---|:---|
| `NOAA_CDO_TOKEN` | **Required.** NOAA CDO API token — obtain free at [ncdc.noaa.gov/cdo-web/token](https://www.ncdc.noaa.gov/cdo-web/token) | — |
| `MCP_TRANSPORT_TYPE` | Transport: `stdio` or `http` | `stdio` |
| `MCP_HTTP_PORT` | HTTP server port | `3010` |
| `MCP_HTTP_ENDPOINT_PATH` | HTTP endpoint path where the MCP server is mounted | `/mcp` |
| `MCP_PUBLIC_URL` | Public origin override for TLS-terminating reverse-proxy deployments | none |
| `MCP_AUTH_MODE` | Authentication: `none`, `jwt`, or `oauth` | `none` |
| `MCP_LOG_LEVEL` | Log level (`debug`, `info`, `warning`, `error`, etc.) | `info` |
| `MCP_GC_PRESSURE_INTERVAL_MS` | Opt-in Bun-only forced-GC pressure loop (ms). Try `60000` if heap growth is observed under sustained HTTP load. | `0` (disabled) |
| `STORAGE_PROVIDER_TYPE` | Storage backend: `in-memory`, `filesystem`, `supabase`, `cloudflare-kv/r2/d1` | `in-memory` |
| `OTEL_ENABLED` | Enable OpenTelemetry | `false` |

## Running the server

### Local development

- **Build and run the production version**:

  ```sh
  # One-time build
  bun run rebuild

  # Run the built server
  bun run start:http
  # or
  bun run start:stdio
  ```

- **Run checks and tests**:
  ```sh
  bun run devcheck  # Lints, formats, type-checks, and more
  bun run test      # Runs the test suite
  ```

## Project structure

| Directory | Purpose |
|:---|:---|
| `src/mcp-server/tools` | Tool definitions (`*.tool.ts`). Seven tools across datasets, locations, stations, and observations. |
| `src/mcp-server/resources` | Resource definitions. Datasets catalog and station metadata resources. |
| `src/services/cdo` | CDO HTTP client with retry, backoff, and camelCase→lowercase parameter translation. |
| `src/config` | Server-specific environment variable parsing and validation with Zod. |
| `tests/` | Unit and integration tests, mirroring the `src/` structure. |

## Development guide

See [`CLAUDE.md`](./CLAUDE.md) for development guidelines and architectural rules. The short version:

- Handlers throw, framework catches — no `try/catch` in tool logic
- Use `ctx.log` for logging, `ctx.state` for storage
- Register new tools and resources in the `createApp()` arrays

## Contributing

Issues and pull requests are welcome. Run checks and tests before submitting:

```sh
bun run devcheck
bun run test
```

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](./LICENSE) file for details.
