/**
 * NASA POWER monthly POINT client for TERRASCAN.
 *
 * - buildPowerUrl(): the request URL (no API key needed).
 * - parsePowerMonthly(): pure parser. Drops POWER's month "13" (its own annual value),
 *   turns the fill value (-999) into null, keeps units from the response.
 * - fetchPowerPoint(): fetch + localStorage cache. Every result says whether it came
 *   from the network ("live") or from the cache ("cached"), with the retrieval time.
 *
 * Values are never filled, interpolated or merged with other datasets.
 */
import type { AggregationRule, MonthlySeries } from "./sciTypes";

export const POWER_MONTHLY_POINT_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point";
export const CACHE_PREFIX = "terrascan:power:v1:";
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PowerPointRequest {
  lat: number;
  lon: number;
  startYear: number;
  endYear: number;
  parameters: string[];
  /** POWER "community"; the units of some parameters depend on it. */
  community?: "AG" | "RE" | "SB";
}

export interface PowerMeta {
  source_url: string;
  retrieved_utc: string;
  origin: "live" | "cached";
  requested: { lat: number; lon: number };
  /** Coordinates POWER actually returned (centre of the model grid cell it used). */
  grid: { lat: number; lon: number; elevation_m: number | null };
  api_version: string | null;
  sources: string[];
  time_standard: string | null;
  fill_value: number;
  community: string;
  parameter_units: Record<string, string>;
  parameter_names: Record<string, string>;
}

export interface PowerPointData {
  meta: PowerMeta;
  series: Record<string, MonthlySeries>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  storage?: StorageLike | null;
  now?: () => Date;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function validateRequest(req: PowerPointRequest): void {
  if (!Number.isFinite(req.lat) || req.lat < -90 || req.lat > 90) throw new Error("Latitude must be between -90 and 90.");
  if (!Number.isFinite(req.lon) || req.lon < -180 || req.lon > 180) throw new Error("Longitude must be between -180 and 180.");
  if (!Number.isInteger(req.startYear) || !Number.isInteger(req.endYear)) throw new Error("Years must be whole numbers.");
  if (req.startYear < 1981) throw new Error("NASA POWER monthly data starts in 1981.");
  if (req.endYear < req.startYear) throw new Error("End year must not be before start year.");
  if (req.parameters.length < 1 || req.parameters.length > 20) throw new Error("Request between 1 and 20 parameters.");
  if (req.parameters.some((p) => !/^[A-Z0-9_]+$/.test(p))) throw new Error("Invalid parameter name.");
}

export function buildPowerUrl(req: PowerPointRequest): string {
  validateRequest(req);
  const params = [
    `parameters=${[...req.parameters].sort().join(",")}`,
    `community=${req.community ?? "AG"}`,
    `longitude=${round4(req.lon)}`,
    `latitude=${round4(req.lat)}`,
    `start=${req.startYear}`,
    `end=${req.endYear}`,
    "format=JSON",
  ];
  return `${POWER_MONTHLY_POINT_URL}?${params.join("&")}`;
}

// ───────────────────────── parser ─────────────────────────

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parsePowerMonthly(
  json: unknown,
  rules: Record<string, AggregationRule>,
  info: {
    source_url: string;
    retrieved_utc: string;
    origin: "live" | "cached";
    requested: { lat: number; lon: number };
    community?: string;
  },
): PowerPointData {
  if (!isObject(json) || !isObject(json.properties) || !isObject(json.properties.parameter)) {
    throw new Error("Unexpected NASA POWER response: no properties.parameter block.");
  }
  const parameter = json.properties.parameter;
  const header = isObject(json.header) ? json.header : {};
  const paramInfo = isObject(json.parameters) ? json.parameters : {};
  const fill = typeof header.fill_value === "number" ? header.fill_value : -999;

  const geometry = isObject(json.geometry) ? json.geometry : {};
  const coords = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const [gLon, gLat, gElev] = coords as Array<unknown>;

  const units: Record<string, string> = {};
  const names: Record<string, string> = {};
  const series: Record<string, MonthlySeries> = {};

  for (const [id, raw] of Object.entries(parameter)) {
    const rule = rules[id];
    if (!rule) continue; // a parameter we did not ask for / do not describe
    if (!isObject(raw)) throw new Error(`Unexpected data for ${id}.`);
    const meta = isObject(paramInfo[id]) ? (paramInfo[id] as Json) : {};
    const unit = typeof meta.units === "string" ? meta.units : "";
    const longname = typeof meta.longname === "string" ? meta.longname : id;
    units[id] = unit;
    names[id] = longname;

    const points: MonthlySeries["series"] = [];
    for (const [key, value] of Object.entries(raw)) {
      if (!/^\d{6}$/.test(key)) continue;
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(4));
      if (month < 1 || month > 12) continue; // month 13 = POWER's own annual value: not a month
      const ok = typeof value === "number" && Number.isFinite(value) && value !== fill;
      points.push({ year, month, value: ok ? (value as number) : null });
    }
    points.sort((a, b) => a.year - b.year || a.month - b.month);
    series[id] = { variable_id: id, name: longname, units: unit, rule, series: points };
  }

  for (const id of Object.keys(rules)) {
    if (!(id in series)) throw new Error(`NASA POWER did not return ${id}.`);
  }

  return {
    meta: {
      source_url: info.source_url,
      retrieved_utc: info.retrieved_utc,
      origin: info.origin,
      requested: info.requested,
      grid: {
        lat: typeof gLat === "number" ? gLat : NaN,
        lon: typeof gLon === "number" ? gLon : NaN,
        elevation_m: typeof gElev === "number" ? gElev : null,
      },
      api_version: isObject(header.api) && typeof header.api.version === "string" ? header.api.version : null,
      sources: Array.isArray(header.sources) ? header.sources.filter((s): s is string => typeof s === "string") : [],
      time_standard: typeof header.time_standard === "string" ? header.time_standard : null,
      fill_value: fill,
      community: info.community ?? "AG",
      parameter_units: units,
      parameter_names: names,
    },
    series,
  };
}

// ───────────────────────── fetch + cache ─────────────────────────

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // access can throw in private mode
  }
}

export function cacheKey(req: PowerPointRequest): string {
  return `${CACHE_PREFIX}${req.community ?? "AG"}:${round4(req.lat)}:${round4(req.lon)}:${req.startYear}:${req.endYear}:${[...req.parameters].sort().join(",")}`;
}

interface CacheEntry {
  retrieved_utc: string;
  source_url: string;
  json: unknown;
}

function readCache(storage: StorageLike | null, key: string, now: Date): CacheEntry | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(key);
    if (!text) return null;
    const entry = JSON.parse(text) as Partial<CacheEntry>;
    if (typeof entry.retrieved_utc !== "string" || typeof entry.source_url !== "string" || entry.json === undefined) return null;
    const age = now.getTime() - new Date(entry.retrieved_utc).getTime();
    if (!Number.isFinite(age) || age < 0 || age > CACHE_MAX_AGE_MS) return null;
    return entry as CacheEntry;
  } catch {
    return null; // corrupt entry: ignore and refetch
  }
}

function writeCache(storage: StorageLike | null, key: string, entry: CacheEntry): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota or private mode: caching is optional */
  }
}

export async function fetchPowerPoint(
  req: PowerPointRequest,
  rules: Record<string, AggregationRule>,
  options: FetchOptions = {},
): Promise<PowerPointData> {
  const url = buildPowerUrl(req);
  const now = (options.now ?? (() => new Date()))();
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const key = cacheKey(req);
  const requested = { lat: round4(req.lat), lon: round4(req.lon) };

  if (!options.forceRefresh) {
    const hit = readCache(storage, key, now);
    if (hit) {
      try {
        return parsePowerMonthly(hit.json, rules, {
          source_url: hit.source_url,
          retrieved_utc: hit.retrieved_utc,
          origin: "cached",
          requested,
          community: req.community,
        });
      } catch {
        /* cached payload no longer fits what we need: fall through to the network */
      }
    }
  }

  const doFetch = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, { signal: options.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach NASA POWER (network error or the browser blocked the request).");
  }
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    throw new Error(`NASA POWER returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const contentType = response.headers?.get("content-type") ?? "application/json";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error("NASA POWER returned a non-JSON response.");
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("NASA POWER returned invalid JSON.");
  }
  const data = parsePowerMonthly(json, rules, {
    source_url: url,
    retrieved_utc: now.toISOString(),
    origin: "live",
    requested,
    community: req.community,
  });
  writeCache(storage, key, { retrieved_utc: now.toISOString(), source_url: url, json });
  return data;
}
