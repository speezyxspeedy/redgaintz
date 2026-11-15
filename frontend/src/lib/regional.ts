import { analyseTrend, type TrendStats } from "./stats";
import { rulesFor } from "./variables";

export const POWER_REGIONAL_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/regional";

export interface RegionalRequest {
  variableId: string;
  startYear: number;
  endYear: number;
  bounds: { west: number; south: number; east: number; north: number };
}

export interface RegionalCellTrend {
  id: string;
  latitude: number;
  longitude: number;
  annualValues: Array<number | null>;
  years: number[];
  stats: TrendStats | null;
  units: string;
}

export interface RegionalTrendResult {
  cells: RegionalCellTrend[];
  years: number[];
  units: string;
  sourceUrl: string;
  retrievedUtc: string;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function annualValue(values: Record<string, unknown>, year: number, rule: "sum_of_daily_rate" | "mean", fill: number): number | null {
  const entries = Object.entries(values).filter(([key, value]) => key.startsWith(String(year)) && typeof value === "number" && Number.isFinite(value) && value !== fill);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, value]) => sum + (value as number), 0);
  return rule === "sum_of_daily_rate" ? total : total / entries.length;
}

export function parseRegionalDaily(json: unknown, request: RegionalRequest, sourceUrl: string, retrievedUtc: string): RegionalTrendResult {
  if (!isObject(json) || !Array.isArray(json.features)) throw new Error("Unexpected NASA POWER regional response.");
  const header = isObject(json.header) ? json.header : {};
  const fill = typeof header.fill_value === "number" ? header.fill_value : -999;
  const parameters = isObject(json.parameters) ? json.parameters : {};
  const parameterMeta: Json = isObject(parameters[request.variableId]) ? parameters[request.variableId] as Json : {};
  const rule = rulesFor([request.variableId])[request.variableId];
  const rawUnits = typeof parameterMeta.units === "string" ? parameterMeta.units : request.variableId;
  const units = rule === "sum_of_daily_rate" && rawUnits === "mm/day" ? "mm/year" : rawUnits;
  const years = Array.from({ length: request.endYear - request.startYear + 1 }, (_, index) => request.startYear + index);
  const cells: RegionalCellTrend[] = [];

  for (const [index, rawFeature] of json.features.entries()) {
    if (!isObject(rawFeature) || !isObject(rawFeature.geometry) || !Array.isArray(rawFeature.geometry.coordinates) || !isObject(rawFeature.properties)) {
      throw new Error("NASA POWER regional response contains an invalid cell.");
    }
    const coordinates = rawFeature.geometry.coordinates;
    const longitude = coordinates[0];
    const latitude = coordinates[1];
    if (typeof longitude !== "number" || typeof latitude !== "number") throw new Error("NASA POWER regional cell has invalid coordinates.");
    const rawParameter = rawFeature.properties.parameter;
    if (!isObject(rawParameter) || !isObject(rawParameter[request.variableId])) throw new Error(`NASA POWER regional cell is missing ${request.variableId}.`);
    const daily = rawParameter[request.variableId] as Record<string, unknown>;
    const annualValues = years.map((year) => annualValue(daily, year, rule, fill));
    const validValues = annualValues.filter((value): value is number => value !== null);
    const stats = validValues.length >= 5 ? analyseTrend(years, annualValues) : null;
    cells.push({ id: `cell-${index}-${latitude}-${longitude}`, latitude, longitude, annualValues, years, stats, units });
  }
  if (!cells.length) throw new Error("NASA POWER returned no regional grid cells.");
  return { cells, years, units, sourceUrl, retrievedUtc };
}

function buildUrl(request: RegionalRequest): string {
  const { bounds } = request;
  const params = new URLSearchParams({
    parameters: request.variableId,
    community: "AG",
    "longitude-min": bounds.west.toFixed(6),
    "latitude-min": bounds.south.toFixed(6),
    "longitude-max": bounds.east.toFixed(6),
    "latitude-max": bounds.north.toFixed(6),
    start: `${request.startYear}0101`,
    end: `${request.endYear}1231`,
    format: "JSON",
    "time-standard": "UTC",
  });
  return `${POWER_REGIONAL_DAILY_URL}?${params.toString()}`;
}

export async function fetchRegionalCellTrends(request: RegionalRequest, signal?: AbortSignal): Promise<RegionalTrendResult> {
  if (!Number.isInteger(request.startYear) || !Number.isInteger(request.endYear) || request.endYear < request.startYear) throw new Error("Invalid regional trend years.");
  const years = Array.from({ length: request.endYear - request.startYear + 1 }, (_, index) => request.startYear + index);
  const payloads: unknown[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < years.length) {
      const index = cursor++;
      const year = years[index];
      const chunk = { ...request, startYear: year, endYear: year };
      const url = buildUrl(chunk);
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`NASA POWER regional request failed with HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("json")) throw new Error("NASA POWER regional response was not JSON.");
      try {
        payloads[index] = await response.json();
      } catch {
        throw new Error("NASA POWER regional response was invalid JSON.");
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, years.length) }, () => worker()));

  const first = payloads[0];
  if (!isObject(first) || !Array.isArray(first.features)) throw new Error("Unexpected NASA POWER regional response.");
  const mergedFeatures = new Map<string, Json>();
  for (const payload of payloads) {
    if (!isObject(payload) || !Array.isArray(payload.features)) throw new Error("Unexpected NASA POWER regional response.");
    for (const rawFeature of payload.features) {
      if (!isObject(rawFeature) || !isObject(rawFeature.geometry) || !Array.isArray(rawFeature.geometry.coordinates) || !isObject(rawFeature.properties)) {
        throw new Error("NASA POWER regional response contains an invalid cell.");
      }
      const coordinates = rawFeature.geometry.coordinates;
      const key = `${coordinates[0]},${coordinates[1]}`;
      const existing = mergedFeatures.get(key);
      if (!existing) {
        mergedFeatures.set(key, JSON.parse(JSON.stringify(rawFeature)) as Json);
        continue;
      }
      const existingProperties = existing.properties as Json;
      const existingParameter = existingProperties.parameter as Json;
      const sourceParameter = rawFeature.properties.parameter as Json;
      const current = existingParameter[request.variableId] as Json;
      const incoming = sourceParameter[request.variableId] as Json;
      if (!isObject(current) || !isObject(incoming)) throw new Error(`NASA POWER regional cell is missing ${request.variableId}.`);
      Object.assign(current, incoming);
    }
  }
  const merged: Json = { ...first, features: [...mergedFeatures.values()] };
  const url = buildUrl(request);
  return parseRegionalDaily(merged, request, url, new Date().toISOString());
}

export function cellExtent(cells: RegionalCellTrend[]): { halfWidth: number; halfHeight: number } {
  const longitudes = [...new Set(cells.map((cell) => cell.longitude))].sort((a, b) => a - b);
  const latitudes = [...new Set(cells.map((cell) => cell.latitude))].sort((a, b) => a - b);
  const smallestStep = (values: number[]) => values.slice(1).reduce((min, value, index) => Math.min(min, value - values[index]), Number.POSITIVE_INFINITY);
  const width = smallestStep(longitudes);
  const height = smallestStep(latitudes);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Regional response did not contain a grid.");
  return { halfWidth: width / 2, halfHeight: height / 2 };
}
