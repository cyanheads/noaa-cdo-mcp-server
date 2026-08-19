/**
 * @fileoverview Tests for CsvStreamReader — the incremental RFC 4180 reader the
 * NCEI bulk exports are parsed with. The exports quote their text columns, embed
 * commas inside them, and write doubled-quote escapes (11,905 of them in Storm
 * Events 2024 alone), so those cases are the contract, not edge cases.
 * @module tests/services/csv-stream-reader.test
 */

import { describe, expect, it } from 'vitest';
import { CsvStreamReader } from '@/services/csv/csv-stream-reader.js';

/** Read a whole source through the reader, optionally split into fixed-size chunks. */
function readAll(source: string, chunkSize = source.length): string[][] {
  const reader = new CsvStreamReader();
  const records: string[][] = [];
  for (let i = 0; i < source.length; i += chunkSize) {
    records.push(...reader.push(source.slice(i, i + chunkSize)));
  }
  records.push(...reader.end());
  return records;
}

describe('CsvStreamReader', () => {
  it('splits plain unquoted rows into fields', () => {
    expect(readAll('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(readAll('"Smith, John",42\n')).toEqual([['Smith, John', '42']]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(readAll('"he said ""go"" loudly",x\n')).toEqual([['he said "go" loudly', 'x']]);
  });

  it('handles a field that is only a doubled quote', () => {
    expect(readAll('"""",b\n')).toEqual([['"', 'b']]);
  });

  it('keeps newlines inside quoted fields as field content, not row breaks', () => {
    expect(readAll('"line one\nline two",b\nnext,row\n')).toEqual([
      ['line one\nline two', 'b'],
      ['next', 'row'],
    ]);
  });

  it('strips CRLF line endings without touching field content', () => {
    expect(readAll('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('preserves empty fields, which is how NCEI writes an unreported value', () => {
    expect(readAll('1,,3,\n')).toEqual([['1', '', '3', '']]);
  });

  it('emits a final record when the source does not end with a newline', () => {
    expect(readAll('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns nothing from end() when the source ended cleanly', () => {
    const reader = new CsvStreamReader();
    expect(reader.push('a,b\n')).toEqual([['a', 'b']]);
    expect(reader.end()).toEqual([]);
  });

  it('produces identical records at every chunk size, including one character at a time', () => {
    const source =
      'EVENT_ID,EVENT_TYPE,DAMAGE_PROPERTY,EVENT_NARRATIVE\r\n' +
      '1,"Hurricane (Typhoon)",1.00B,"Trees down, power out; a gust ""over 100 mph"" was measured."\r\n' +
      '2,Hail,,"Multi-line\nnarrative, with a comma"\r\n';
    const whole = readAll(source);

    expect(whole).toEqual([
      ['EVENT_ID', 'EVENT_TYPE', 'DAMAGE_PROPERTY', 'EVENT_NARRATIVE'],
      [
        '1',
        'Hurricane (Typhoon)',
        '1.00B',
        'Trees down, power out; a gust "over 100 mph" was measured.',
      ],
      ['2', 'Hail', '', 'Multi-line\nnarrative, with a comma'],
    ]);

    for (const chunkSize of [1, 2, 3, 7, 13, 64]) {
      expect(readAll(source, chunkSize)).toEqual(whole);
    }
  });

  it('resolves a doubled quote split across a chunk boundary', () => {
    const reader = new CsvStreamReader();
    expect(reader.push('"a"')).toEqual([]);
    expect(reader.push('"b",c\n')).toEqual([['a"b', 'c']]);
  });

  it('resolves a closing quote split across a chunk boundary', () => {
    const reader = new CsvStreamReader();
    expect(reader.push('"a"')).toEqual([]);
    expect(reader.push(',b\n')).toEqual([['a', 'b']]);
  });

  it('carries an unterminated quoted field across chunks', () => {
    const reader = new CsvStreamReader();
    expect(reader.push('"start of narra')).toEqual([]);
    expect(reader.push('tive, still going')).toEqual([]);
    expect(reader.push('",end\n')).toEqual([['start of narrative, still going', 'end']]);
  });

  it('handles a row break landing exactly on a chunk boundary', () => {
    const reader = new CsvStreamReader();
    expect(reader.push('a,b\n')).toEqual([['a', 'b']]);
    expect(reader.push('c,d\n')).toEqual([['c', 'd']]);
  });

  it('handles a CRLF split across a chunk boundary', () => {
    const reader = new CsvStreamReader();
    expect(reader.push('a,b\r')).toEqual([]);
    expect(reader.push('\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns an empty field list for a blank line rather than skipping it', () => {
    expect(readAll('a,b\n\nc,d\n')).toEqual([['a', 'b'], [''], ['c', 'd']]);
  });
});
