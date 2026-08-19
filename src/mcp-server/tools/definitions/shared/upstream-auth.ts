/**
 * @fileoverview Recognize NOAA CDO refusing the API token this server sends.
 * @module mcp-server/tools/definitions/shared/upstream-auth
 */

import type { McpError } from '@cyanheads/mcp-ts-core/errors';

/**
 * CDO's wording when it rejects the API token this server sends.
 *
 * Arrives as JSON — `{"status" : "400", "message" : "The token parameter
 * provided is not valid."}` — where every parameter rejection is an XML fault.
 * It is the one 4xx a well-formed request hits routinely, and nothing about the
 * caller's input caused it, so it is kept off `validation_error`, whose
 * recovery sends the agent off to re-verify IDs that were never the problem and
 * fails identically on every retry.
 */
const UPSTREAM_TOKEN_REJECTION = /token parameter provided is not valid/i;

/**
 * True when an upstream rejection is CDO refusing the configured token.
 *
 * One predicate for every CDO-backed tool: each route sends the same `token`
 * header, so a deployment holding a bad one fails identically on all of them,
 * and a per-tool copy of this pattern is a per-tool copy to drift.
 *
 * CdoService recovers CDO's own explanation onto the message and
 * `data.upstreamMessage`; both are read so the routing holds whichever one a
 * future caller inspects.
 */
export function isUpstreamTokenRejection(error: McpError): boolean {
  return UPSTREAM_TOKEN_REJECTION.test(`${error.data?.upstreamMessage ?? ''} ${error.message}`);
}
