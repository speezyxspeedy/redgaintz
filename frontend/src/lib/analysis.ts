import { aggregate, daysInMonth, MONTH_NAMES, SEASONS } from "./aggregate";
import type { AggregatedSeries, MonthlySeries, ViewSpec } from "./sciTypes";
import { analyseTrend, type TrendStats } from "./stats";
import { buildVerdict, type Verdict } from "./verdict";
import { prettyUnits, type VariableCard } from "./variables";

export interface Analysis {
  agg: AggregatedSeries;
  stats: TrendStats | null;
  verdict: Verdict | null;
  /** Why no trend could be computed (too few years, etc.). */
  problem: string | null;
}

/** Same numbers, friendlier unit symbols. */
export function withPrettyUnits(s: MonthlySeries): MonthlySeries {
  return { ...s, units: prettyUnits(s.units) };
}

export function viewToParam(v: ViewSpec): string {
  if (v.kind === "season") return `season:${v.seasonId}`;
  if (v.kind === "month") return `month:${v.month}`;
  return v.kind;
}

export function paramToView(text: string | null | undefined): ViewSpec {
  if (!text) return { kind: "annual" };
  if (text === "anomaly") return { kind: "anomaly" };
  if (text.startsWith("season:")) {
    const id = text.slice(7);
    if (SEASONS.some((s) => s.id === id)) return { kind: "season", seasonId: id };
  }
  if (text.startsWith("month:")) {
    const m = Number(text.slice(6));
    if (Number.isInteger(m) && m >= 1 && m <= 12) return { kind: "month", month: m };
  }
  return { kind: "annual" };
}

export function analyse(series: MonthlySeries, card: VariableCard, view: ViewSpec, startYear: number, endYear: number): Analysis {
  const agg = aggregate(series, view, { startYear, endYear });
  try {
    const stats = analyseTrend(agg.years, agg.values);
    const verdict = buildVerdict({
      stats,
      variableName: card.short_name,
      viewLabel: agg.label,
      units: agg.units,
      firstYear: agg.yearsUsed[0] ?? startYear,
      lastYear: agg.yearsUsed[agg.yearsUsed.length - 1] ?? endYear,
      yearsSkipped: agg.yearsSkipped.length,
      hidePercent: view.kind === "anomaly",
    });
    return { agg, stats, verdict, problem: null };
  } catch (e) {
    return { agg, stats: null, verdict: null, problem: e instanceof Error ? e.message : "The trend could not be computed." };
  }
}

export interface CycleMonth {
  month: number;
  label: string;
  mean: number | null;
  min: number | null;
  max: number | null;
  n: number;
}

/** Average year: for every calendar month, mean/min/max over the selected years (rainfall as monthly totals in mm). */
export function seasonalCycle(series: MonthlySeries, startYear: number, endYear: number): { months: CycleMonth[]; units: string } {
  const isSum = series.rule === "sum_of_daily_rate";
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const p of series.series) {
    if (p.year < startYear || p.year > endYear || p.value === null || p.month < 1 || p.month > 12) continue;
    buckets[p.month - 1].push(isSum ? p.value * daysInMonth(p.year, p.month) : p.value);
  }
  const months = buckets.map((vals, i) => ({
    month: i + 1,
    label: MONTH_NAMES[i],
    mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    min: vals.length ? Math.min(...vals) : null,
    max: vals.length ? Math.max(...vals) : null,
    n: vals.length,
  }));
  return { months, units: isSum ? series.units.replace(/\/day$/, "") : series.units };
}

/** Months (1..12) that the current view uses, for highlighting on the seasonal chart. */
export function monthsInView(view: ViewSpec): number[] {
  if (view.kind === "season") return SEASONS.find((s) => s.id === view.seasonId)?.months ?? [];
  if (view.kind === "month") return [view.month];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

export function toCsv(a: Analysis, card: VariableCard, placeLabel: string): string {
  const stats = a.stats;
  const rows: string[] = [];
  rows.push(`# TERRASCAN export`);
  rows.push(`# variable: ${card.short_name} (${card.id}); place: ${placeLabel}; view: ${a.agg.label}; units: ${a.agg.units}`);
  rows.push(`# source: NASA POWER monthly (MERRA-2 based); ${a.agg.method_note}`);
  if (stats) {
    rows.push(`# Sen slope per year: ${stats.sen_slope}; 95% CI: ${stats.sen_slope_ci95[0]} to ${stats.sen_slope_ci95[1]}; Mann-Kendall Z: ${stats.mk_z}; p: ${stats.p_value}; significant at ${stats.alpha}: ${stats.significant}`);
  }
  rows.push("year,value,units,used");
  a.agg.years.forEach((y, i) => {
    const v = a.agg.values[i];
    rows.push(`${y},${v === null ? "" : v},${a.agg.units.replace(/,/g, " ")},${v === null ? "skipped" : "yes"}`);
  });
  return rows.join("\n");
}
