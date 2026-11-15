/** Shared types for the TERRASCAN science core (monthly series -> views -> trend). */

/**
 * How a monthly value turns into a season/annual value.
 * - "sum_of_daily_rate": the monthly value is a per-day rate (e.g. mm/day). The
 *   total is the sum of rate x days in each month (rainfall).
 * - "mean": the total is the day-weighted mean of the monthly values
 *   (temperature, humidity, wind, pressure, solar).
 */
export type AggregationRule = "sum_of_daily_rate" | "mean";

export interface MonthlyPoint {
  year: number;
  /** 1..12. POWER's month "13" (its own annual value) must never appear here. */
  month: number;
  value: number | null;
}

export interface MonthlySeries {
  variable_id: string;
  name: string;
  /** Units of the monthly value as POWER reports them, e.g. "mm/day", "C", "%". */
  units: string;
  rule: AggregationRule;
  series: MonthlyPoint[];
}

export type ViewSpec =
  | { kind: "annual" }
  | { kind: "season"; seasonId: string }
  | { kind: "month"; month: number }
  | { kind: "anomaly" };

export interface SeasonDef {
  id: string;
  label: string;
  /** In calendar order of the season, e.g. [12, 1, 2] for Dec-Feb. */
  months: number[];
}

export interface SkippedYear {
  year: number;
  reason: string;
}

export interface MonthlyAnomaly {
  year: number;
  month: number;
  value: number;
}

export interface AggregatedSeries {
  view: ViewSpec;
  /** Plain-English description, e.g. "Monsoon (Jun-Sep) total". */
  label: string;
  units: string;
  /** Every year in the requested range, in order. */
  years: number[];
  /** Same length as years; null where the year was skipped. */
  values: Array<number | null>;
  yearsUsed: number[];
  yearsSkipped: SkippedYear[];
  /** One-sentence description of how each value was computed. */
  method_note: string;
  /** Anomaly view only. */
  monthlyAnomaly?: MonthlyAnomaly[];
  /** Anomaly view only: mean of each calendar month over the selected years (index 0 = January). */
  climatology?: Array<number | null>;
}
