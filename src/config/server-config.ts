/**
 * @fileoverview Server-specific configuration for noaa-climate-mcp-server.
 * @module config/server-config
 */

import { z } from '@cyanheads/mcp-ts-core';
import { parseEnvConfig } from '@cyanheads/mcp-ts-core/config';

const ServerConfigSchema = z.object({
  token: z
    .string()
    .min(1)
    .describe(
      'NOAA CDO API token. Obtain free at https://www.ncdc.noaa.gov/cdo-web/token. Sent as `token` header on every request.',
    ),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

let _config: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  _config ??= parseEnvConfig(ServerConfigSchema, {
    token: 'NOAA_CDO_TOKEN',
  });
  return _config;
}
