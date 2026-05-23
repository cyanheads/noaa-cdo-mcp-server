/**
 * @fileoverview Domain types for the NOAA CDO API v2.
 * @module services/cdo/types
 */

/** Pagination metadata in CDO API responses. */
export type ResultsetMetadata = {
  limit: number;
  count: number;
  offset: number;
};

/** CDO collection response envelope. */
export type CdoCollectionResponse<T> = {
  results?: T[];
  metadata?: { resultset: ResultsetMetadata };
};

/** A CDO dataset (e.g. GHCND, GSOM, GSOY). */
export type CdoDataset = {
  id: string;
  name: string;
  datacoverage: number;
  mindate: string;
  maxdate: string;
};

/** A CDO data category (e.g. TEMP, PRCP). */
export type CdoDataCategory = {
  id: string;
  name: string;
};

/** A CDO data type (e.g. TMAX, TMIN, PRCP). */
export type CdoDataType = {
  id: string;
  name: string;
  datacoverage?: number;
  mindate?: string;
  maxdate?: string;
};

/** A CDO location (city, state, country, etc.). */
export type CdoLocation = {
  id: string;
  name: string;
  datacoverage?: number;
  mindate?: string;
  maxdate?: string;
};

/** A CDO weather station. */
export type CdoStation = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  elevationUnit?: string;
  mindate?: string;
  maxdate?: string;
  datacoverage?: number;
};

/** A single CDO observation data record. */
export type CdoDataRecord = {
  date: string;
  datatype: string;
  station: string;
  value: number;
  attributes?: string;
};

/** Parameters accepted by CDO collection endpoints. All fields are optional. */
export type CdoListParams = {
  datasetid?: string | string[] | undefined;
  datacategoryid?: string | undefined;
  locationid?: string | string[] | undefined;
  stationid?: string | string[] | undefined;
  datatypeid?: string | string[] | undefined;
  locationcategoryid?: string | undefined;
  startdate?: string | undefined;
  enddate?: string | undefined;
  sortfield?: string | undefined;
  sortorder?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  extent?: string | undefined;
  units?: string | undefined;
  includemetadata?: boolean | undefined;
};
