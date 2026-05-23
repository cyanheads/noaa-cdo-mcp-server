# noaa-cdo-mcp-server

Historical climate and weather station data via NOAA Climate Data Online (CDO) API.

## Data source

- **NOAA CDO API v2** — historical weather/climate observations at station level
- **Auth**: Free API token required (register at ncdc.noaa.gov)
- **Rate limits**: 5 requests/second, 1000/day with free token

## Why it earns its keep

Complements NWS weather (forecasts/current conditions) with the historical record. Station-level climate data going back decades. Heavy demand from researchers, agriculture, insurance, real estate, and anyone asking "what's the climate like in X?"

## Target users

- Researchers analyzing climate trends
- Agriculture and farming (historical precipitation, temperature patterns)
- Insurance and risk assessment
- Real estate ("what's the weather like in this area?")
- Agents combining historical climate with current NWS forecasts

## Scope

- Read-only
- Dataset discovery (GHCN-Daily, Global Summary of the Month, etc.)
- Station search by location, dataset, date range
- Observation data queries (temperature, precipitation, wind, etc.)
- Data type/category browsing
- Location hierarchy (country → state → county → station)
