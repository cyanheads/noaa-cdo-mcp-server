# Changelog

All notable changes to this project. Each entry links to its full per-version file in [changelog/](changelog/).

## [0.1.5](changelog/0.1.x/0.1.5.md) — 2026-05-23

metadata alignment — package.json scripts use bun, tsx removed from devDeps, .env.example restructured, .gitignore/.mcpbignore aligned, Dockerfile labels updated, server.json MCP_PUBLIC_URL added, manifest.json reformatted

## [0.1.4](changelog/0.1.x/0.1.4.md) — 2026-05-23

sync tagline across all surfaces — package.json, server.json, manifest.json, README, GitHub description

## [0.1.3](changelog/0.1.x/0.1.3.md) — 2026-05-24

not-found guard for noaa_get_station, resource double-encoding fix, 1-based offset descriptions across 6 tools, metadata polish

## [0.1.2](changelog/0.1.x/0.1.2.md) — 2026-05-23

Station resource not-found handling: detect empty-object responses from NOAA CDO and throw a not-found error

## [0.1.1](changelog/0.1.x/0.1.1.md) — 2026-05-23

NOAA Climate Data Online MCP server — 7 tools and 2 resources for historical weather observations

## [0.1.0](changelog/0.1.x/0.1.0.md) — 2026-05-23

Initial release — NOAA CDO API v2 MCP server with 7 tools and 2 resources for historical weather data access
