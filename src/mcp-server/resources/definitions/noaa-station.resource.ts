/**
 * @fileoverview Resource exposing NOAA CDO station metadata by station ID.
 * @module mcp-server/resources/definitions/noaa-station
 */

import { resource, z } from '@cyanheads/mcp-ts-core';
import { notFound } from '@cyanheads/mcp-ts-core/errors';
import { getCdoService } from '@/services/cdo/cdo-service.js';

export const noaaStationResource = resource('noaa://stations/{stationId}', {
  name: 'NOAA CDO Station',
  description:
    'Station metadata by ID — name, coordinates, elevation, and the full date range for which data is available. Mirrors noaa_get_station as an injectable resource. URI format: noaa://stations/GHCND:USC00450974.',
  params: z.object({
    stationId: z.string().describe('Station ID (e.g., GHCND:USC00450974, COOP:010008).'),
  }),

  async handler(params, ctx) {
    ctx.log.debug('Fetching station resource', { stationId: params.stationId });
    const service = getCdoService();
    try {
      const station = await service.getStation(params.stationId, ctx);
      return JSON.stringify(station, null, 2);
    } catch (err) {
      // 404 from the API — surface as notFound so MCP clients get the right code
      if (
        err instanceof Error &&
        (err.message.includes('404') || err.message.toLowerCase().includes('not found'))
      ) {
        throw notFound(
          `Station "${params.stationId}" not found. Verify the ID format (e.g., GHCND:USC00450974) or use noaa_find_stations to discover valid IDs.`,
          { stationId: params.stationId },
          { cause: err },
        );
      }
      throw err;
    }
  },
});
