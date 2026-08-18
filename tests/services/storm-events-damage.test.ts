/**
 * @fileoverview Tests for parseDamageEstimate. Every literal here is a value
 * form observed in the live NCEI Storm Events files: the `H` hundreds
 * magnitude (six cells, 1994–1995), the malformed cells that must stay
 * unparsed (`K`/`M` with no number, 1999–2006; `0T` in 1996; `0?` in 1993 and
 * 1995), and the abbreviated fractional amounts older years write as `.5M`.
 * @module tests/services/storm-events-damage.test
 */

import { describe, expect, it } from 'vitest';
import { parseDamageEstimate } from '@/services/storm-events/damage.js';

describe('parseDamageEstimate — magnitude suffixes', () => {
  it('parses a K suffix as thousands', () => {
    expect(parseDamageEstimate('75.00K')).toEqual({ raw: '75.00K', amountInUsd: 75_000 });
  });

  it('parses an M suffix as millions', () => {
    expect(parseDamageEstimate('1.20M')).toEqual({ raw: '1.20M', amountInUsd: 1_200_000 });
  });

  it('parses a B suffix as billions', () => {
    expect(parseDamageEstimate('1.00B')).toEqual({ raw: '1.00B', amountInUsd: 1_000_000_000 });
  });

  it('does not mistake a B value for thousands or a parse failure', () => {
    const parsed = parseDamageEstimate('2.50B');
    expect(parsed?.amountInUsd).toBe(2_500_000_000);
    expect(parsed?.amountInUsd).not.toBe(2_500);
    expect(Number.isNaN(parsed?.amountInUsd)).toBe(false);
  });

  it('accepts lowercase suffixes', () => {
    expect(parseDamageEstimate('3k')?.amountInUsd).toBe(3_000);
    expect(parseDamageEstimate('3m')?.amountInUsd).toBe(3_000_000);
    expect(parseDamageEstimate('3b')?.amountInUsd).toBe(3_000_000_000);
  });

  it('parses an integer amount with a suffix', () => {
    expect(parseDamageEstimate('250K')).toEqual({ raw: '250K', amountInUsd: 250_000 });
  });

  it('parses a bare number as literal dollars', () => {
    expect(parseDamageEstimate('0')).toEqual({ raw: '0', amountInUsd: 0 });
  });

  it('parses the abbreviated fractional forms older years write', () => {
    expect(parseDamageEstimate('.5M')?.amountInUsd).toBe(500_000);
    expect(parseDamageEstimate('.25K')?.amountInUsd).toBe(250);
    expect(parseDamageEstimate('.01K')?.amountInUsd).toBe(10);
  });

  it('avoids binary floating-point dust on fractional amounts', () => {
    expect(parseDamageEstimate('1.20M')?.amountInUsd).toBe(1_200_000);
    expect(parseDamageEstimate('0.07M')?.amountInUsd).toBe(70_000);
    expect(parseDamageEstimate('1.10B')?.amountInUsd).toBe(1_100_000_000);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseDamageEstimate('  5.00K  ')).toEqual({ raw: '5.00K', amountInUsd: 5_000 });
  });
});

describe('parseDamageEstimate — the H (hundreds) magnitude', () => {
  it('parses an H suffix as hundreds', () => {
    expect(parseDamageEstimate('5H')).toEqual({ raw: '5H', amountInUsd: 500 });
    expect(parseDamageEstimate('2H')).toEqual({ raw: '2H', amountInUsd: 200 });
  });

  it('accepts the lowercase form the 1994 file writes', () => {
    expect(parseDamageEstimate('2h')).toEqual({ raw: '2h', amountInUsd: 200 });
  });

  it('does not read an H value as thousands or as a parse failure', () => {
    const parsed = parseDamageEstimate('5H');
    expect(parsed?.amountInUsd).toBe(500);
    expect(parsed?.amountInUsd).not.toBe(5_000);
  });
});

describe('parseDamageEstimate — a confirmed zero', () => {
  it('parses "0.00K" to the number zero, not NaN', () => {
    const parsed = parseDamageEstimate('0.00K');
    expect(parsed).toEqual({ raw: '0.00K', amountInUsd: 0 });
    expect(Number.isNaN(parsed?.amountInUsd)).toBe(false);
  });

  it('keeps a confirmed zero distinguishable from an unreported value', () => {
    const confirmed = parseDamageEstimate('0.00K');
    const unreported = parseDamageEstimate('');
    expect(confirmed?.amountInUsd).toBe(0);
    expect(unreported).toBeUndefined();
    expect(confirmed).not.toEqual(unreported);
  });
});

describe('parseDamageEstimate — not reported', () => {
  it('returns undefined for an empty cell rather than zero', () => {
    const parsed = parseDamageEstimate('');
    expect(parsed).toBeUndefined();
    expect(parsed?.amountInUsd).not.toBe(0);
  });

  it('returns undefined for a whitespace-only cell', () => {
    expect(parseDamageEstimate('   ')).toBeUndefined();
  });
});

describe('parseDamageEstimate — malformed cells', () => {
  it('keeps the raw text and omits the amount for a suffix with no number', () => {
    expect(parseDamageEstimate('K')).toEqual({ raw: 'K' });
  });

  it('keeps the raw text and omits the amount for an unknown suffix', () => {
    expect(parseDamageEstimate('0T')).toEqual({ raw: '0T' });
  });

  it('keeps a bare M unparsed, exactly like the bare K', () => {
    expect(parseDamageEstimate('M')).toEqual({ raw: 'M' });
  });

  it('keeps a bare H unparsed — a magnitude with no number is still malformed', () => {
    expect(parseDamageEstimate('H')).toEqual({ raw: 'H' });
  });

  it('keeps the 0? cell 1993 and 1995 write unparsed', () => {
    expect(parseDamageEstimate('0?')).toEqual({ raw: '0?' });
  });

  it('keeps the raw text and omits the amount for non-numeric content', () => {
    expect(parseDamageEstimate('unknown')).toEqual({ raw: 'unknown' });
  });

  it('rejects a negative amount rather than inventing a sign', () => {
    expect(parseDamageEstimate('-5K')).toEqual({ raw: '-5K' });
  });

  it('never yields NaN as an amount', () => {
    for (const raw of ['K', 'M', 'H', '0T', '0?', 'unknown', '-5K', '1.2.3M', '5.']) {
      const parsed = parseDamageEstimate(raw);
      expect(parsed?.amountInUsd === undefined || Number.isFinite(parsed.amountInUsd)).toBe(true);
    }
  });

  it('stays distinguishable from an unreported cell — raw survives, amount does not', () => {
    const malformed = parseDamageEstimate('0T');
    expect(malformed?.raw).toBe('0T');
    expect(malformed?.amountInUsd).toBeUndefined();
    expect(parseDamageEstimate('')).toBeUndefined();
  });
});
