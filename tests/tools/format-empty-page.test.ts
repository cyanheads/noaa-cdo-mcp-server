/**
 * @fileoverview `format()` empty-list wording across every collection tool.
 *
 * `format()` receives only the domain payload — never the `exhausted` /
 * `totalCount` enrichment — so an empty `results` array is the same input for a
 * genuine no-match and for a page past the end of a large result set. The
 * rendered line must therefore be true in both cases and claim neither.
 * @module tests/tools/format-empty-page.test
 */

import { describe, expect, it } from 'vitest';
import { noaaClimateFetchData } from '@/mcp-server/tools/definitions/noaa-climate-fetch-data.tool.js';
import { noaaClimateFindLocations } from '@/mcp-server/tools/definitions/noaa-climate-find-locations.tool.js';
import { noaaClimateFindStations } from '@/mcp-server/tools/definitions/noaa-climate-find-stations.tool.js';
import { noaaClimateListDataCategories } from '@/mcp-server/tools/definitions/noaa-climate-list-data-categories.tool.js';
import { noaaClimateListDataTypes } from '@/mcp-server/tools/definitions/noaa-climate-list-data-types.tool.js';
import { noaaClimateListDatasets } from '@/mcp-server/tools/definitions/noaa-climate-list-datasets.tool.js';
import { noaaClimateListLocationCategories } from '@/mcp-server/tools/definitions/noaa-climate-list-location-categories.tool.js';
import { firstText } from '../helpers/content.js';

const COLLECTION_TOOLS = [
  ['noaa_climate_fetch_data', noaaClimateFetchData],
  ['noaa_climate_find_locations', noaaClimateFindLocations],
  ['noaa_climate_find_stations', noaaClimateFindStations],
  ['noaa_climate_list_data_categories', noaaClimateListDataCategories],
  ['noaa_climate_list_data_types', noaaClimateListDataTypes],
  ['noaa_climate_list_datasets', noaaClimateListDatasets],
  ['noaa_climate_list_location_categories', noaaClimateListLocationCategories],
] as const;

/** Wording that asserts the query itself found nothing — false on an exhausted page. */
const NO_MATCH_CLAIM =
  /matched|no .*(records|stations|locations|datasets|categories|data types) (found|matched|were returned)/i;

describe.each(COLLECTION_TOOLS)('%s — empty-page rendering', (_name, def) => {
  it('renders the neutral empty-page line', () => {
    const blocks = def.format!({ results: [] } as never);

    expect(firstText(blocks)).toContain('No records on this page.');
  });

  it('does not claim the query matched nothing', () => {
    const blocks = def.format!({ results: [] } as never);

    expect(firstText(blocks)).not.toMatch(NO_MATCH_CLAIM);
  });

  it('keeps the wording neutral when CDO did return a nonzero total for the query', () => {
    const blocks = def.format!({
      results: [],
      metadata: { resultset: { count: 51, limit: 5, offset: 56 } },
    } as never);
    const text = firstText(blocks);

    expect(text).toContain('No records on this page.');
    expect(text).not.toMatch(NO_MATCH_CLAIM);
  });
});
