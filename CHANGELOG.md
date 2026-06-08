# Changelog

All notable changes to this project. Each entry links to its full per-version file in [changelog/](changelog/).

## [0.1.13](changelog/0.1.x/0.1.13.md) — 2026-06-08

noaa_fetch_data pre-request datasetId validation, noaa_get_station not_found recovery hint, corrected entity counts in two tool descriptions

## [0.1.12](changelog/0.1.x/0.1.12.md) — 2026-06-04

HTTP 400 errors from the NOAA CDO API now surface as structured validation_error with recovery hints across all 6 tools

## [0.1.11](changelog/0.1.x/0.1.11.md) — 2026-06-02

Adopt @cyanheads/mcp-ts-core 0.9.21 — per-request log context fix, secret scrubbing from error messages, withRetry fail-fast on non-retryable errors

## [0.1.10](changelog/0.1.x/0.1.10.md) — 2026-05-30

Enrichment adoption — discovery and fetch tools now surface query echoes, result totals, and empty-result guidance in a typed enrichment block.

## [0.1.9](changelog/0.1.x/0.1.9.md) — 2026-05-28 · 🛡️ Security

mcp-ts-core ^0.9.9 → ^0.9.13: 413 body cap, HTTP session-init gate, quieter 401/403/400/404 logging, landing.requireAuth, GET /mcp keywords

## [0.1.8](changelog/0.1.x/0.1.8.md) — 2026-05-24

code simplification, mcp-ts-core ^0.9.7 → ^0.9.9, error code corrections

## [0.1.7](changelog/0.1.x/0.1.7.md) — 2026-05-24

pagination offset fix and dead error contract cleanup

## [0.1.6](changelog/0.1.x/0.1.6.md) — 2026-05-23

hosted server endpoint — remotes block in server.json, public URL in README

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
