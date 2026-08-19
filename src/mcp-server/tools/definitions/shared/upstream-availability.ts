/**
 * @fileoverview Recognize NOAA CDO being unavailable or throttling this server.
 * @module mcp-server/tools/definitions/shared/upstream-availability
 */

import { JsonRpcErrorCode, type McpError } from '@cyanheads/mcp-ts-core/errors';

/** The transient upstream reasons every CDO-backed tool declares. */
export type UpstreamOutageReason = 'rate_limited' | 'service_unavailable';

/**
 * The declared reason for an upstream failure nothing about the input caused,
 * or `undefined` when the failure is not one of those.
 *
 * Keyed on the error code alone, never on a status or a message. A
 * `ServiceUnavailable` reaches a tool three ways — a status-mapped 502, 503, or
 * any other 5xx; `CdoService.get()` raising it itself for NOAA's HTML
 * interstitial; and a network-level failure that never produced a response at
 * all — and only the first of the three carries a `status` to key on. The code
 * is the one field all three share, and it is the field the contract pairs each
 * reason with.
 *
 * One predicate for every CDO-backed tool: all eight send the same `token`, so
 * they share its rate-limit bucket and go down together when NOAA does. A
 * per-tool copy of this mapping is a per-tool copy to drift.
 *
 * A throttled token is kept off `service_unavailable` deliberately. They are
 * different next moves — an unavailable service is retried unchanged, a
 * throttled one has to be paced down first — and folding them together would
 * emit a reason the contract declares under `ServiceUnavailable` on an error
 * the status mapped to `RateLimited`.
 */
export function upstreamOutageReason(error: McpError): UpstreamOutageReason | undefined {
  if (error.code === JsonRpcErrorCode.RateLimited) return 'rate_limited';
  if (error.code === JsonRpcErrorCode.ServiceUnavailable) return 'service_unavailable';
  return;
}
