/**
 * @fileoverview Domain types for the NCEI Billion-Dollar Weather and Climate
 * Disasters corpus.
 *
 * Every cost on these types is whole US dollars. NCEI publishes three different
 * cost units across the four files this module reads, so the unit is resolved
 * from each file's own preamble and converted once, in the service — nothing
 * downstream of these types carries a unit ambiguity.
 *
 * @module services/billion-dollar-disasters/types
 */

/** The seven disaster classes NCEI assigns, written exactly as the export writes them. */
export const DISASTER_TYPES = [
  'Drought',
  'Flooding',
  'Freeze',
  'Severe Storm',
  'Tropical Cyclone',
  'Wildfire',
  'Winter Storm',
] as const;

export type DisasterType = (typeof DISASTER_TYPES)[number];

/** The row the per-year files carry alongside the seven classes: their total. */
export const ALL_DISASTERS = 'All Disasters';

/** One disaster from an `events-*.csv` export. */
export type BillionDollarDisaster = {
  /** NCEI's own event name, e.g. "Hurricane Helene (September 2024)". */
  name: string;
  /** One of the seven NCEI disaster classes. */
  disasterType: string;
  /** Event start as an ISO calendar date, rewritten from the export's `YYYYMMDD`. */
  beginDate: string;
  /** Event end as an ISO calendar date. */
  endDate: string;
  /** CPI-adjusted cost in whole US dollars. */
  cpiAdjustedCostInUsd: number;
  /** Cost in the dollars of the year it occurred, in whole US dollars. */
  unadjustedCostInUsd: number;
  /** Deaths NCEI attributes to the event. */
  deaths: number;
};

/** NCEI's uncertainty band around a national cost estimate, in whole US dollars. */
export type CostConfidenceBounds = {
  lower75: number;
  upper75: number;
  lower90: number;
  upper90: number;
  lower95: number;
  upper95: number;
};

/** One disaster class's tally within one year of a `time-series-*.csv` export. */
export type DisasterTypeTally = {
  /** One of the seven classes, or `All Disasters` for the year's total. */
  disasterType: string;
  /** Disasters of this class NCEI counts in the year. */
  eventCount: number;
  /**
   * CPI-adjusted cost in whole US dollars.
   *
   * Absent on the per-state exports, which publish a binned range in place of a
   * point estimate.
   */
  costInUsd?: number;
  /** NCEI's 75/90/95% bands around `costInUsd`. National export only. */
  confidenceBoundsInUsd?: CostConfidenceBounds;
  /**
   * The bin NCEI publishes instead of a point estimate on the per-state
   * exports, e.g. `2000-5000` (millions) → 2,000,000,000–5,000,000,000 USD.
   */
  costRangeInUsd?: { low: number; high: number };
};

/** One year of a `time-series-*.csv` export. */
export type DisasterYearSummary = {
  year: number;
  /** The seven classes plus `All Disasters`, in the export's own column order. */
  byDisasterType: DisasterTypeTally[];
};

/** What every read of a Billions export carries about the file it came from. */
export type BillionDollarSource = {
  /** The file read, e.g. `events-US.csv`. */
  sourceFile: string;
  /** The cost unit the file declares in its own preamble, verbatim. */
  declaredCostUnit: string;
  /** Earliest and latest year present in the file, read from the rows themselves. */
  firstYear: number;
  lastYear: number;
};

export type DisasterQuery = {
  /** Two-letter US postal code, or undefined for the national export. */
  state?: string;
  startYear?: number;
  endYear?: number;
  disasterType?: string;
  minCostInUsd?: number;
  limit: number;
  offset: number;
};

export type DisasterEventsResult = BillionDollarSource & {
  disasters: BillionDollarDisaster[];
  /** Matches across the whole file, before offset and limit. */
  totalCount: number;
  /** Disaster classes present in the file, for a zero-match notice. */
  disasterTypesInFile: string[];
};

export type DisasterSummaryResult = BillionDollarSource & {
  summaries: DisasterYearSummary[];
  totalCount: number;
};
