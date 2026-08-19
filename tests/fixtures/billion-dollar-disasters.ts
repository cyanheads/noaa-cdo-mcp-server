/**
 * @fileoverview Verbatim slices of NOAA/NCEI's Billion-Dollar Weather and
 * Climate Disasters exports, captured from the live files on 2026-08-18.
 *
 * Preambles, header rows, quoting, and cell values are byte-for-byte as NCEI
 * publishes them — including the detail these fixtures exist for: the four
 * exports do not share a cost unit. `events-US.csv` and `events-CA.csv` declare
 * millions, `time-series-US.csv` declares billions, and `time-series-CA.csv`
 * declares millions again while publishing a binned range instead of a point
 * estimate. Editing a unit line here changes what the parser is being asked to
 * do, which is the point of the swapped variants below.
 *
 * @module tests/fixtures/billion-dollar-disasters
 */

/** The national per-event export: two preamble lines, then the header. Costs in millions. */
export const EVENTS_US_CSV = `Weather and Climate Billion-Dollar Disasters to affect the U.S. from 1980-2024
Cost values are in millions of dollars
Name,Disaster,Begin Date,End Date,CPI-Adjusted Cost,Unadjusted Cost,Deaths
"Southern Severe Storms and Flooding (April 1980)",Flooding,19800410,19800417,2756.4,706.8,30
"Severe Storms, Flash Floods, Hail, Tornadoes (May 1981)",Severe Storm,19810505,19810510,1409.1,401.4,20
"Gulf States Storms and Flooding (December 1982-January 1983)",Flooding,19821201,19830115,4946.2,1536.1,45
"Hurricane Helene (September 2024)",Tropical Cyclone,20240924,20240929,78721,78721,219
"Hurricane Milton (October 2024)",Tropical Cyclone,20241009,20241010,34250,34250,32
"Southern/Eastern/Northwestern Drought and Heat Wave (2024)",Drought,20240101,20241231,5417,5311,136
`;

/** The national per-year export: two `#` comments, a blank line, then a 66-column header. Costs in billions. */
export const TIME_SERIES_US_CSV = `# Title: United States Billion-Dollar Disasters Cost (CPI-Adjusted)
# Cost values are in billions of dollars

State,Year,"Drought Count","Drought Cost","Drought Lower 75","Drought Upper 75","Drought Lower 90","Drought Upper 90","Drought Lower 95","Drought Upper 95","Flooding Count","Flooding Cost","Flooding Lower 75","Flooding Upper 75","Flooding Lower 90","Flooding Upper 90","Flooding Lower 95","Flooding Upper 95","Freeze Count","Freeze Cost","Freeze Lower 75","Freeze Upper 75","Freeze Lower 90","Freeze Upper 90","Freeze Lower 95","Freeze Upper 95","Severe Storm Count","Severe Storm Cost","Severe Storm Lower 75","Severe Storm Upper 75","Severe Storm Lower 90","Severe Storm Upper 90","Severe Storm Lower 95","Severe Storm Upper 95","Tropical Cyclone Count","Tropical Cyclone Cost","Tropical Cyclone Lower 75","Tropical Cyclone Upper 75","Tropical Cyclone Lower 90","Tropical Cyclone Upper 90","Tropical Cyclone Lower 95","Tropical Cyclone Upper 95","Wildfire Count","Wildfire Cost","Wildfire Lower 75","Wildfire Upper 75","Wildfire Lower 90","Wildfire Upper 90","Wildfire Lower 95","Wildfire Upper 95","Winter Storm Count","Winter Storm Cost","Winter Storm Lower 75","Winter Storm Upper 75","Winter Storm Lower 90","Winter Storm Upper 90","Winter Storm Lower 95","Winter Storm Upper 95","All Disasters Count","All Disasters Cost","All Disasters Lower 75","All Disasters Upper 75","All Disasters Lower 90","All Disasters Upper 90","All Disasters Lower 95","All Disasters Upper 95"
US,1980,1,40.7,32.5,48.7,30,51.2,28.8,52.4,1,2.8,1.6,3.1,1.6,3.9,1.2,4.3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2.2,1.5,3,1.5,3.8,1.1,4.9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,45.7,35.6,54.8,33.1,58.9,31.1,61.6
US,2023,1,14.8,13.1,17.3,12.5,18,11.9,18.8,4,9.3,7.8,11,6.8,11.9,6.1,12.9,0,0,0,0,0,0,0,0,19,55.7,50.4,59.7,48.2,62.4,46.5,64.1,2,8,6.6,9,6.2,10,5.7,10.7,1,5.7,4.1,6.3,3.8,6.8,3.5,7.4,1,1.8,1.6,2.1,1.5,2.2,1.4,2.3,28,95.3,83.6,105.4,79,111.3,75.1,116.2
US,2024,1,5.4,4.5,6.6,4.4,6.8,4.2,7.1,1,1.1,1,1.3,0.9,1.4,0.8,1.4,0,0,0,0,0,0,0,0,17,46.8,42.7,50.4,41,51.8,39.2,53.5,5,124,104.2,143.5,100.1,147.9,96.9,152.4,1,1.8,1.4,2,1.2,2.1,1.2,2.1,2,3.6,3.4,4.2,3.2,4.4,3,4.6,27,182.7,157.2,208,150.8,214.4,145.3,221.1
`;

/** A per-state per-event export. Rows are national disasters that reached the state, carrying the national cost. */
export const EVENTS_CA_CSV = `Weather and Climate Billion-Dollar Disasters to affect California from 1980-2024
Cost values are in millions of dollars
Name,Disaster,Begin Date,End Date,CPI-Adjusted Cost,Unadjusted Cost,Deaths
"Western Storms and Flooding (December 1982-March 1983)",Flooding,19821213,19830331,4828.7,1499.6,50
"Western Fire Season (Summer 1990)",Wildfire,19900601,19900831,1716,715,17
"California Flooding (February 2017)",Flooding,20170208,20170222,1950,1500,5
`;

/** A per-state per-year export: binned cost ranges in millions, no point estimate, no confidence bands. */
export const TIME_SERIES_CA_CSV = `# Title: California Billion-Dollar Disasters Cost (CPI-Adjusted)
# Cost ranges are in millions of dollars

State,Year,"Drought Count","Drought Cost Range","Flooding Count","Flooding Cost Range","Freeze Count","Freeze Cost Range","Severe Storm Count","Severe Storm Cost Range","Tropical Cyclone Count","Tropical Cyclone Cost Range","Wildfire Count","Wildfire Cost Range","Winter Storm Count","Winter Storm Cost Range","All Disasters Count","All Disasters Cost Range"
CA,1983,0,0-0,1,2000-5000,0,0-0,0,0-0,0,0-0,0,0-0,0,0-0,1,2000-5000
CA,2022,1,2000-5000,0,0-0,0,0-0,0,0-0,0,0-0,1,1000-2000,0,0-0,2,2000-5000
CA,2024,0,0-0,0,0-0,0,0-0,0,0-0,0,0-0,0,0-0,0,0-0,0,0-0
`;

/**
 * The national per-event export with its declared unit swapped to billions.
 *
 * Nothing else changes — same rows, same numbers. A parser that reads the unit
 * from the file scales every cost 1,000x here; one that assumes millions for
 * anything named `events-*.csv` returns the same figures as the real fixture.
 */
export const EVENTS_US_CSV_DECLARING_BILLIONS = EVENTS_US_CSV.replace(
  'Cost values are in millions of dollars',
  'Cost values are in billions of dollars',
);

/** The national per-year export with its declared unit swapped to millions. */
export const TIME_SERIES_US_CSV_DECLARING_MILLIONS = TIME_SERIES_US_CSV.replace(
  '# Cost values are in billions of dollars',
  '# Cost values are in millions of dollars',
);

/** An export whose preamble names a unit this server does not recognize. */
export const EVENTS_US_CSV_DECLARING_UNKNOWN_UNIT = EVENTS_US_CSV.replace(
  'Cost values are in millions of dollars',
  'Cost values are in zorkmids of dollars',
);

/** An export with its unit note stripped, leaving no unit to convert from. */
export const EVENTS_US_CSV_WITHOUT_UNIT_NOTE = EVENTS_US_CSV.replace(
  'Cost values are in millions of dollars\n',
  '',
);

/** An export whose header row is present but missing a column the reader needs. */
export const EVENTS_US_CSV_MISSING_COLUMN = EVENTS_US_CSV.replace(
  'Name,Disaster,Begin Date,End Date,CPI-Adjusted Cost,Unadjusted Cost,Deaths',
  'Name,Disaster,Begin Date,Finish Date,CPI-Adjusted Cost,Unadjusted Cost,Deaths',
);

/** An export carrying its preamble and header but no data rows. */
export const EVENTS_US_CSV_WITHOUT_ROWS = EVENTS_US_CSV.split('\n').slice(0, 3).join('\n');

/**
 * The per-state per-event export with a disaster that begins in one year and
 * ends in the next — NCEI's California Flooding (December 2022-March 2023).
 *
 * The year filter matches on overlap, so a 2023 query returns this row. A
 * coverage span read from begin years alone would report 2022 as the last year
 * the file holds, contradicting the row the same response just returned.
 */
export const EVENTS_CA_CSV_CROSSING_NEW_YEAR = `${EVENTS_CA_CSV}"California Flooding (December 2022-March 2023)",Flooding,20221227,20230317,4859.5,4614.7,22
`;
