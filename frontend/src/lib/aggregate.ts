import type {
  AggregatedSeries,
  MonthlyAnomaly,
  MonthlySeries,
  SeasonDef,
  SkippedYear,
  ViewSpec,
} from "./sciTypes";

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Indian meteorological seasons. */
export const SEASONS: SeasonDef[] = [
  { id: "winter", label: "Winter (Dec–Feb)", months: [12, 1, 2] },
  { id: "premonsoon", label: "Pre-monsoon (Mar–May)", months: [3, 4, 5] },
  { id: "monsoon", label: "Monsoon (Jun–Sep)", months: [6, 7, 8, 9] },
  { id: "postmonsoon", label: "Post-monsoon (Oct–Nov)", months: [10, 11] },
];

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface RangeOptions {
  startYear: number;
  endYear: number;
}

function totalUnits(units: string): string {
  return units.replace(/\/day$/, "");
}

function buildIndex(series: MonthlySeries): Map<number, number | null> {
  const index = new Map<number, number | null>();
  for (const p of series.series) {
    if (p.month < 1 || p.month > 12) continue; // defensive: never accept POWER's month 13
    const v = p.value;
    index.set(p.year * 100 + p.month, v !== null && Number.isFinite(v) ? v : null);
  }
  return index;
}

function get(index: Map<number, number | null>, year: number, month: number): number | null {
  return index.get(year * 100 + month) ?? null;
}

/** Combine the months of one (season-)year. Returns null if any month is missing. */
function combine(
  series: MonthlySeries,
  index: Map<number, number | null>,
  year: number,
  months: number[],
): { value: number | null; missing: number[] } {
  const wrap = months.length > 1 && months[0] > months[months.length - 1];
  let weighted = 0;
  let days = 0;
  const missing: number[] = [];
  for (const m of months) {
    const calYear = wrap && m >= months[0] ? year - 1 : year;
    const v = get(index, calYear, m);
    if (v === null) {
      missing.push(m);
      continue;
    }
    const d = daysInMonth(calYear, m);
    weighted += v * d;
    days += d;
  }
  if (missing.length) return { value: null, missing };
  return { value: series.rule === "sum_of_daily_rate" ? weighted : weighted / days, missing };
}

function missingReason(missing: number[]): string {
  return `missing monthly value${missing.length > 1 ? "s" : ""}: ${missing.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
}

export function aggregate(
  series: MonthlySeries,
  view: ViewSpec,
  { startYear, endYear }: RangeOptions,
): AggregatedSeries {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    throw new Error("Invalid year range.");
  }
  const index = buildIndex(series);
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);
  const isSum = series.rule === "sum_of_daily_rate";

  if (view.kind === "anomaly") return anomalyView(series, index, years, view);

  let months: number[];
  let label: string;
  if (view.kind === "annual") {
    months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    label = isSum ? "Annual total" : "Annual mean";
  } else if (view.kind === "season") {
    const season = SEASONS.find((s) => s.id === view.seasonId);
    if (!season) throw new Error(`Unknown season: ${view.seasonId}`);
    months = season.months;
    label = `${season.label} ${isSum ? "total" : "mean"}`;
  } else {
    if (!Number.isInteger(view.month) || view.month < 1 || view.month > 12) {
      throw new Error("Month must be 1..12.");
    }
    months = [view.month];
    label = `${MONTH_NAMES[view.month - 1]} ${isSum ? "total" : "mean"}`;
  }

  const values: Array<number | null> = [];
  const yearsUsed: number[] = [];
  const yearsSkipped: SkippedYear[] = [];
  for (const y of years) {
    const { value, missing } = combine(series, index, y, months);
    values.push(value);
    if (value === null) yearsSkipped.push({ year: y, reason: missingReason(missing) });
    else yearsUsed.push(y);
  }

  return {
    view,
    label,
    units: isSum ? totalUnits(series.units) : series.units,
    years,
    values,
    yearsUsed,
    yearsSkipped,
    method_note: isSum
      ? "Each monthly rate is multiplied by the days in that month, then the months are added. Years with any missing month are skipped."
      : "The monthly values are averaged, weighted by the days in each month. Years with any missing month are skipped.",
  };
}

function anomalyView(
  series: MonthlySeries,
  index: Map<number, number | null>,
  years: number[],
  view: ViewSpec,
): AggregatedSeries {
  // Climatology: mean of each calendar month over the selected years.
  const climatology: Array<number | null> = [];
  for (let m = 1; m <= 12; m++) {
    const vals = years.map((y) => get(index, y, m)).filter((v): v is number => v !== null);
    climatology.push(vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null);
  }

  const monthlyAnomaly: MonthlyAnomaly[] = [];
  const values: Array<number | null> = [];
  const yearsUsed: number[] = [];
  const yearsSkipped: SkippedYear[] = [];
  for (const y of years) {
    const anomalies: number[] = [];
    const missing: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const v = get(index, y, m);
      const c = climatology[m - 1];
      if (v === null || c === null) {
        missing.push(m);
        continue;
      }
      anomalies.push(v - c);
      monthlyAnomaly.push({ year: y, month: m, value: v - c });
    }
    if (missing.length) {
      values.push(null);
      yearsSkipped.push({ year: y, reason: missingReason(missing) });
    } else {
      values.push(anomalies.reduce((s, v) => s + v, 0) / 12);
      yearsUsed.push(y);
    }
  }

  return {
    view,
    label: "Deseasonalised anomaly (yearly average)",
    units: series.units,
    years,
    values,
    yearsUsed,
    yearsSkipped,
    method_note:
      "For every calendar month, the average over the selected years is subtracted (this removes the seasonal cycle). The 12 monthly anomalies of a year are then averaged. Years with any missing month are skipped.",
    monthlyAnomaly,
    climatology,
  };
}
