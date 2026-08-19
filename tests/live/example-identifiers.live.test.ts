/**
 * @fileoverview Opt-in live lane: every example identifier the server hands an
 * agent must resolve against the NOAA CDO API.
 *
 * Tool descriptions, `.describe()` prose, recovery hints, the README, and the
 * design doc all carry hand-written example IDs, and an agent copies them
 * verbatim on a first call. Nothing else in the build can tell a live ID from a
 * dead one — the linter checks schema shape, typecheck cannot reach a string
 * literal's meaning, and the unit suite runs on fixtures by design. This lane
 * closes that gap, and stays out of `bun run test` so the default lane keeps no
 * network dependency: run it with `bun run test:live`.
 *
 * @module tests/live/example-identifiers.live.test
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { KNOWN_DATASETS } from '@/mcp-server/tools/definitions/noaa-climate-fetch-data.tool.js';
import { collectExampleIdentifiers, ID_PREFIX_ENDPOINTS } from '../helpers/example-identifiers.js';

const BASE_URL = 'https://www.ncei.noaa.gov/cdo-web/api/v2';

/** CDO rate-limits a token to 5 requests per second. */
const REQUEST_SPACING_MS = 250;

/**
 * The location categories the README and the design doc both claim are the
 * complete set of 12.
 *
 * Pinned as a literal because the claim itself — "12 in total" — is what the
 * documentation makes; reading the list back from CDO to compare against CDO
 * would assert nothing.
 */
const DOCUMENTED_LOCATION_CATEGORIES = [
  'CITY',
  'CLIM_DIV',
  'CLIM_REG',
  'CNTRY',
  'CNTY',
  'HYD_ACC',
  'HYD_CAT',
  'HYD_REG',
  'HYD_SUB',
  'ST',
  'US_TERR',
  'ZIP',
];

let token: string;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch one record by ID.
 *
 * CDO answers an unknown ID with HTTP 200 and a bare `{}` rather than a 404,
 * so a resolved record is one that came back carrying its own `id`.
 */
async function resolveRecord(
  endpoint: string,
  id: string,
): Promise<{ id?: string; name?: string }> {
  const response = await fetch(`${BASE_URL}/${endpoint}/${encodeURIComponent(id)}`, {
    headers: { token },
  });
  if (!response.ok) {
    throw new Error(`CDO answered HTTP ${response.status} for ${endpoint}/${id}.`);
  }
  await sleep(REQUEST_SPACING_MS);
  return (await response.json()) as { id?: string; name?: string };
}

beforeAll(() => {
  const configured = process.env.NOAA_CDO_TOKEN;
  if (!configured) {
    throw new Error(
      'The live lane resolves example identifiers against the real CDO API and needs NOAA_CDO_TOKEN set. Request a free token at https://www.ncdc.noaa.gov/cdo-web/token.',
    );
  }
  token = configured;
});

describe('example identifiers resolve against the live CDO API', () => {
  const identifiers = collectExampleIdentifiers();

  it('finds identifiers to check on the documented surfaces', () => {
    expect(identifiers.length).toBeGreaterThan(0);
  });

  it.each(identifiers)(
    'resolves $id (from $sources)',
    async ({ id, prefix }) => {
      const endpoint = ID_PREFIX_ENDPOINTS[prefix];
      expect(
        endpoint,
        `"${id}" carries the prefix "${prefix}", which addresses no CDO collection. An agent copying this example cannot reach a record at all — check whether the prefix was confused with a location category (climate regions are CLIM:104, not CLIM_REG:…).`,
      ).toBeDefined();

      const record = await resolveRecord(endpoint as string, id);
      expect(
        record.id,
        `${id} does not resolve — CDO returns an empty record for it. An agent copying this example lands on not_found.`,
      ).toBe(id);
    },
    30_000,
  );
});

describe('advertised CDO vocabularies still exist upstream', () => {
  it.each([...KNOWN_DATASETS])(
    'resolves dataset %s, which noaa_climate_fetch_data accepts',
    async (datasetId) => {
      const record = await resolveRecord('datasets', datasetId);
      expect(record.id).toBe(datasetId);
    },
    30_000,
  );

  it.each(DOCUMENTED_LOCATION_CATEGORIES)(
    'resolves location category %s',
    async (categoryId) => {
      const record = await resolveRecord('locationcategories', categoryId);
      expect(record.id).toBe(categoryId);
    },
    30_000,
  );

  it('documents every location category CDO publishes, and no others', async () => {
    const response = await fetch(`${BASE_URL}/locationcategories?limit=1000`, {
      headers: { token },
    });
    const body = (await response.json()) as { results?: { id: string }[] };
    const upstream = (body.results ?? []).map((c) => c.id).sort();
    expect(upstream).toEqual([...DOCUMENTED_LOCATION_CATEGORIES].sort());
  }, 30_000);
});
