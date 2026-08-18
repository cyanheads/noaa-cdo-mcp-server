/**
 * @fileoverview Shared input-validation schemas for NOAA CDO date and identifier
 * filters, plus the UTC normalization the date comparisons depend on.
 * @module mcp-server/tools/definitions/shared/validation
 */

import { z } from '@cyanheads/mcp-ts-core';

/**
 * Date forms NOAA CDO accepts: a compact `YYYYMMDD`, a dashed calendar date
 * whose month and day may be unpadded, or a dashed date with a full ISO-8601
 * local time and optional fractional seconds. CDO rejects a `Z` suffix, a UTC
 * offset, a space separator, and a minute-precision time, so those are excluded
 * deliberately rather than by oversight.
 *
 * The unpadded form is accepted on every CDO endpoint except `/data`, which
 * answers it with a 400. That asymmetry is left to CDO — a per-endpoint schema
 * variant would cost uniformity across the tool surface to pre-empt one
 * endpoint's stricter parsing, and the 400 already surfaces as a
 * `validation_error`.
 *
 * Structural bounds (month, day, hour, minute, second ranges) live in the
 * pattern so they reach clients through the advertised JSON Schema; only
 * month-length overflow needs the refinement below.
 */
const ISO_DATE_PATTERN =
  /^(?:\d{4}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])|\d{4}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?)?)$/;

/** The compact, separator-free form. */
const COMPACT_DATE_PATTERN = /^\d{8}$/;

/** The dashed form, with the month and day possibly unpadded and an optional time tail. */
const DASHED_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/;

const DATE_FORMAT_MESSAGE =
  'Date must be YYYY-MM-DD, YYYYMMDD, or YYYY-MM-DDTHH:MM:SS (optionally with fractional seconds). In the dashed form the month and day may be unpadded.';

const CALENDAR_MESSAGE = 'Date is not a real calendar date.';

const BLANK_MESSAGE = 'Identifier must not be empty or whitespace-only.';

/**
 * Rewrite any accepted date form to the canonical zero-padded, dashed one.
 *
 * Every comparison below indexes fixed offsets or hands the value to
 * `Date.parse`, and both read the compact and unpadded forms as garbage —
 * `Date.parse('20240701Z')` is `NaN`, which would make the range and ordering
 * guards evaluate false and stop firing without ever erroring. Normalizing
 * first is what keeps those guards honest for every form the schema admits.
 *
 * Purely internal: the value sent upstream is always the caller's own, since
 * CDO accepts each accepted form on the endpoints the schema documents.
 */
function normalizeCdoDate(value: string): string {
  if (COMPACT_DATE_PATTERN.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  const [, year = '', month = '', day = '', time = ''] = DASHED_DATE_PATTERN.exec(value) ?? [];
  if (!year) return value;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${time}`;
}

/**
 * Reject day-of-month values the month cannot hold (e.g. 2024-02-30,
 * 2024-06-31). Accepts any form the date pattern admits.
 */
function isRealCalendarDate(value: string): boolean {
  const normalized = normalizeCdoDate(value);
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  const day = Number(normalized.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

/**
 * Parse a validated CDO date to epoch milliseconds on a single timeline.
 * Accepts any form the date pattern admits.
 *
 * `new Date()` reads a bare date as UTC midnight but a bare datetime as *local*
 * midnight, so comparing the two forms directly is off by the host's UTC offset.
 * Anchoring both to UTC keeps ordering and range-length checks stable wherever
 * the server runs.
 */
export function toUtcMillis(value: string): number {
  const normalized = normalizeCdoDate(value);
  return Date.parse(normalized.length === 10 ? `${normalized}T00:00:00Z` : `${normalized}Z`);
}

/**
 * A NOAA CDO date filter — compact date, bare date, or full ISO-8601 datetime.
 *
 * `abort` stops the chain at a shape failure so the calendar refinement never
 * reports on input that never matched the pattern: its verdict would be read
 * off the wrong offsets, and one bad value would draw two messages, the second
 * of them false.
 */
export function isoDateFilter(description: string) {
  return z
    .string()
    .regex(ISO_DATE_PATTERN, { error: DATE_FORMAT_MESSAGE, abort: true })
    .refine(isRealCalendarDate, CALENDAR_MESSAGE)
    .describe(description);
}

/**
 * The single blank-rejection rule both identifier filters build on. `min(1)`
 * carries the constraint to clients as JSON Schema `minLength`; the refinement
 * catches whitespace-only input, which `minLength` alone admits. `abort` keeps
 * an empty string from drawing both messages, which carry identical text.
 */
function nonBlankIdentifier() {
  return z
    .string()
    .min(1, { error: BLANK_MESSAGE, abort: true })
    .refine((v) => v.trim().length > 0, BLANK_MESSAGE);
}

/**
 * A scalar CDO identifier filter. Values stay opaque — the check only rejects
 * empty and whitespace-only input, and never trims or rewrites a real ID.
 */
export function identifierFilter(description: string) {
  return nonBlankIdentifier().describe(description);
}

/**
 * A repeated CDO identifier filter. An empty array and blank entries are both
 * rejected: the service layer drops falsy entries when building the query
 * string, so either one silently widens the query instead of narrowing it.
 */
export function identifierArrayFilter(description: string) {
  return z
    .array(nonBlankIdentifier())
    .min(1, 'Provide at least one identifier, or omit the filter entirely.')
    .describe(description);
}
