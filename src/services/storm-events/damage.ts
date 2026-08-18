/**
 * @fileoverview Parse NCEI Storm Events damage estimates, which arrive as
 * magnitude-suffixed strings rather than numbers, and keep an unreported value
 * distinguishable from a confirmed zero.
 * @module services/storm-events/damage
 */

import type { DamageEstimate } from './types.js';

/**
 * The shape NCEI writes: a decimal amount with an optional magnitude suffix.
 *
 * `K` and `M` occur throughout and `B` on the largest events (2024's four
 * billion-dollar rows are Hurricane Helene's Florida entries). `H` is hundreds:
 * six cells in the whole corpus — `5H` four times and `2H` once in 1995, `2h`
 * once in 1994, every one of them `DAMAGE_PROPERTY`. Nothing documents it. The
 * current NCEI bulk-CSV and export-format PDFs enumerate no magnitude codes at
 * all and show `K` and `M` only by example, so `H` rests on the NWS Storm Data
 * convention plus the narratives on those six rows, which describe downed tree
 * limbs and a flagpole — hundreds of dollars, not hundreds of thousands.
 * Leaving it out of the pattern made those rows unparseable, which dropped them
 * from `minDamageInUsd` filtering altogether.
 *
 * A bare number occurs too, and is not always `0`: 315 non-zero bare cells span
 * 1993–1995 and 2008–2015, from `3` and `.50` up through `500`, `50000`, and
 * `4500000`. They are read as literal dollars.
 *
 * The leading digits are optional because older years abbreviate a fractional
 * amount to `.5M` and `.25K`, which a `\d+`-anchored pattern would reject as
 * malformed and silently drop from damage filtering — 1996 alone writes 2,577
 * of them.
 */
const DAMAGE_PATTERN = /^(\d*\.?\d+)([HKMB])?$/i;

const MULTIPLIERS: Record<string, number> = {
  h: 100,
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

/**
 * Parse one `DAMAGE_PROPERTY` / `DAMAGE_CROPS` cell.
 *
 * Three outcomes, deliberately distinct:
 *
 * - **Not reported** — `undefined`. An empty cell means NCEI has no figure
 *   (21.6% of 2024 rows), which is not the same claim as `"0.00K"`. Returning
 *   `0` here would report unknown damage as a confirmed absence of damage.
 * - **Reported and parsed** — `{ raw, amountInUsd }`.
 * - **Reported but unparseable** — `{ raw }` with no `amountInUsd`. The live
 *   files carry 54 malformed cells in all: a magnitude with no number in front
 *   of it (`K` 48 times across 1999–2006, peaking at 30 in 2003, and `M` once
 *   in 2006), `0?` four times in 1993 and 1995, and `0T` once in 1996.
 *   Preserving the raw text with no number keeps the value visible without
 *   inventing a figure for it.
 */
export function parseDamageEstimate(raw: string): DamageEstimate | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  const match = DAMAGE_PATTERN.exec(trimmed);
  if (!match) return { raw: trimmed };

  const [, amount = '', suffix] = match;
  const multiplier = suffix ? MULTIPLIERS[suffix.toLowerCase()] : 1;
  if (multiplier === undefined) return { raw: trimmed };

  // Round to cents: 1.2 * 1e6 lands on 1200000.0000000002 in binary floating point.
  return { raw: trimmed, amountInUsd: Math.round(Number(amount) * multiplier * 100) / 100 };
}
