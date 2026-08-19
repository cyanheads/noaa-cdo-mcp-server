/**
 * @fileoverview Incremental RFC 4180 CSV reader for the NCEI bulk exports. Text
 * arrives in arbitrary chunks — from a decompression stream for Storm Events, in
 * one piece for the small Billion-Dollar Disasters files — so the reader carries
 * its quote and field state across `push()` calls and yields only records it has
 * seen terminated.
 * @module services/csv/csv-stream-reader
 */

const QUOTE = 34;
const COMMA = 44;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;

/**
 * Streaming CSV record reader.
 *
 * Written by hand rather than pulled from npm because the whole contract is
 * quoted fields, doubled-quote escapes, and CRLF — and the NCEI exports need
 * all three: Storm Events narrative columns are quoted and carry embedded
 * commas, 2024 alone holds 11,905 doubled-quote escapes, and 37 of the 403
 * Billion-Dollar Disasters names are quoted for the same reason ("Severe
 * Storms, Flash Floods, Hail, Tornadoes (May 1981)").
 *
 * Fields are accumulated by slicing the chunk rather than appending per
 * character, so an unquoted field costs one slice regardless of length.
 */
export class CsvStreamReader {
  private field = '';
  private row: string[] = [];
  private inQuotes = false;
  /**
   * True when the previous character was a quote inside a quoted field and the
   * next one decides its meaning: another quote is a literal `"`, anything else
   * closed the field. The decision can straddle a chunk boundary, so it is
   * reader state rather than a lookahead.
   */
  private quotePending = false;

  /** Feed one decoded chunk; returns every record it completed. */
  push(chunk: string): string[][] {
    const records: string[][] = [];
    let start = 0;

    for (let i = 0; i < chunk.length; i++) {
      const code = chunk.charCodeAt(i);

      if (this.quotePending) {
        this.quotePending = false;
        if (code === QUOTE) {
          this.field += '"';
          start = i + 1;
          continue;
        }
        this.inQuotes = false;
        start = i;
      }

      if (this.inQuotes) {
        if (code === QUOTE) {
          this.field += chunk.slice(start, i);
          this.quotePending = true;
          start = i + 1;
        }
        continue;
      }

      switch (code) {
        case QUOTE:
          this.field += chunk.slice(start, i);
          this.inQuotes = true;
          start = i + 1;
          break;
        case COMMA:
          this.field += chunk.slice(start, i);
          this.row.push(this.field);
          this.field = '';
          start = i + 1;
          break;
        case CARRIAGE_RETURN:
          this.field += chunk.slice(start, i);
          start = i + 1;
          break;
        case LINE_FEED:
          this.field += chunk.slice(start, i);
          this.row.push(this.field);
          records.push(this.row);
          this.row = [];
          this.field = '';
          start = i + 1;
          break;
        default:
          break;
      }
    }

    this.field += chunk.slice(start);
    return records;
  }

  /**
   * Flush a final record when the source did not end with a newline. Returns an
   * empty array when the last chunk ended cleanly, so callers can always append
   * the result.
   */
  end(): string[][] {
    if (this.field.length === 0 && this.row.length === 0) return [];
    this.row.push(this.field);
    const record = this.row;
    this.row = [];
    this.field = '';
    return [record];
  }
}
