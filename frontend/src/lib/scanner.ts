import { aggregate } from "./aggregate";
import { fetchPowerPoint, type FetchOptions, type PowerMeta } from "./power";
import { analyseTrend, ols, type TrendStats } from "./stats";
import type { MonthlySeries } from "./sciTypes";
import { rulesFor, VARIABLES, type VariableCard } from "./variables";

export interface ScannerRequest {
  lat: number;
  lon: number;
  startYear: number;
  endYear: number;
  variableIds?: string[];
}

export interface ScannerRow {
  variable: VariableCard;
  units: string;
  yearsUsed: number[];
  annualValues: Array<number | null>;
  trend: TrendStats | null;
  senSlopePerDecade: number | null;
  effectSD: number | null;
  effectLabel: "small" | "moderate" | "large" | "insufficient data";
  adjustedP: number | null;
  significantAfterCorrection: boolean;
  error?: string;
}

export interface ScannerResult {
  rows: ScannerRow[];
  meta: PowerMeta | null;
  origin: "live" | "cached";
  retrievedUtc: string;
}

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function effectLabel(effect: number | null): ScannerRow["effectLabel"] {
  if (effect === null || !Number.isFinite(effect)) return "insufficient data";
  const magnitude = Math.abs(effect);
  return magnitude < 0.25 ? "small" : magnitude < 0.75 ? "moderate" : "large";
}

function residualEffect(stats: TrendStats, years: number[], values: Array<number | null>): number | null {
  const points = years
    .map((year, index) => ({ year, value: values[index] }))
    .filter((point): point is { year: number; value: number } => point.value !== null && Number.isFinite(point.value));
  if (points.length < 3) return null;
  const fit = ols(points.map((point) => point.year), points.map((point) => point.value));
  const residuals = points.map((point) => point.value - (fit.intercept + fit.slope * point.year));
  const mean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const sd = Math.sqrt(residuals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (residuals.length - 1));
  return sd > 0 ? (stats.sen_slope * (points.length - 1)) / sd : null;
}

/** Benjamini-Hochberg adjusted p-values, returned in the original order. */
export function benjaminiHochberg(pValues: number[], q = 0.05): number[] {
  if (!(q > 0 && q <= 1)) throw new Error("q must be between 0 and 1.");
  const indexed = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(pValues.length).fill(1);
  let running = 1;
  for (let i = indexed.length - 1; i >= 0; i--) {
    const rank = i + 1;
    running = Math.min(running, (indexed[i].p * indexed.length) / rank);
    adjusted[indexed[i].index] = Math.min(1, Number(running.toPrecision(15)));
  }
  return adjusted;
}

function rowFor(card: VariableCard, series: MonthlySeries, startYear: number, endYear: number): ScannerRow {
  const annual = aggregate(series, { kind: "annual" }, { startYear, endYear });
  try {
    const trend = analyseTrend(annual.years, annual.values);
    const effectSD = residualEffect(trend, annual.years, annual.values);
    return {
      variable: card,
      units: annual.units,
      yearsUsed: annual.yearsUsed,
      annualValues: annual.values,
      trend,
      senSlopePerDecade: trend.sen_slope * 10,
      effectSD,
      effectLabel: effectLabel(effectSD),
      adjustedP: null,
      significantAfterCorrection: false,
    };
  } catch (error) {
    return {
      variable: card,
      units: annual.units,
      yearsUsed: annual.yearsUsed,
      annualValues: annual.values,
      trend: null,
      senSlopePerDecade: null,
      effectSD: null,
      effectLabel: "insufficient data",
      adjustedP: null,
      significantAfterCorrection: false,
      error: error instanceof Error ? error.message : "Insufficient data.",
    };
  }
}

export async function scanTrends(request: ScannerRequest, options: FetchOptions = {}): Promise<ScannerResult> {
  if (!Number.isFinite(request.lat) || request.lat < -90 || request.lat > 90) throw new Error("Latitude must be between -90 and 90.");
  if (!Number.isFinite(request.lon) || request.lon < -180 || request.lon > 180) throw new Error("Longitude must be between -180 and 180.");
  if (!Number.isInteger(request.startYear) || !Number.isInteger(request.endYear) || request.endYear < request.startYear) {
    throw new Error("Invalid scanner year range.");
  }
  const ids = request.variableIds ?? VARIABLES.map((variable) => variable.id);
  const cards = ids.map((id) => VARIABLES.find((variable) => variable.id === id)).filter((card): card is VariableCard => Boolean(card));
  if (!cards.length) throw new Error("Choose at least one catalogue variable.");
  const base = { lat: request.lat, lon: request.lon, startYear: request.startYear, endYear: request.endYear };
  const fetched = await Promise.all(
    batches(cards, 20).map((batch) => fetchPowerPoint({ ...base, parameters: batch.map((card) => card.id) }, rulesFor(batch.map((card) => card.id)), options)),
  );
  const series = Object.assign({}, ...fetched.map((data) => data.series));
  const rows = cards.map((card) => rowFor(card, series[card.id], request.startYear, request.endYear));
  const pValues = rows.map((row) => row.trend?.p_value ?? 1);
  const adjusted = benjaminiHochberg(pValues);
  rows.forEach((row, index) => {
    row.adjustedP = row.trend ? adjusted[index] : null;
    row.significantAfterCorrection = row.trend !== null && adjusted[index] <= 0.05;
  });
  rows.sort((a, b) => {
    if (a.significantAfterCorrection !== b.significantAfterCorrection) return a.significantAfterCorrection ? -1 : 1;
    return (a.adjustedP ?? 1) - (b.adjustedP ?? 1) || Math.abs(b.effectSD ?? 0) - Math.abs(a.effectSD ?? 0);
  });
  const meta = fetched[0]?.meta ?? null;
  return {
    rows,
    meta,
    origin: meta?.origin ?? "cached",
    retrievedUtc: meta?.retrieved_utc ?? "",
  };
}
