import { analyseTrend, type TrendStats } from "./stats";

export interface RobustnessWindow {
  startYear: number;
  endYear: number;
  stats: TrendStats | null;
}

/** Enumerate all overlapping year windows with at least `minYears` calendar years. */
export function enumerateRobustnessWindows(
  years: ReadonlyArray<number>,
  values: ReadonlyArray<number | null>,
  minYears = 10,
): RobustnessWindow[] {
  if (years.length !== values.length) throw new Error("Years and values must have equal lengths.");
  if (!Number.isInteger(minYears) || minYears < 3) throw new Error("minYears must be at least three.");
  const windows: RobustnessWindow[] = [];
  for (let start = 0; start < years.length; start++) {
    for (let end = start; end < years.length; end++) {
      if (years[end] - years[start] + 1 < minYears) continue;
      const windowYears = years.slice(start, end + 1);
      const windowValues = values.slice(start, end + 1);
      let stats: TrendStats | null = null;
      try {
        stats = analyseTrend(windowYears, windowValues);
      } catch {
        stats = null;
      }
      windows.push({ startYear: years[start], endYear: years[end], stats });
    }
  }
  return windows;
}

export function robustnessSummary(windows: RobustnessWindow[], reference: TrendStats | null): {
  sameDirectionSignificant: number;
  tested: number;
  percent: number;
} {
  const referenceSign = reference ? Math.sign(reference.sen_slope) : 0;
  const valid = windows.filter((window) => window.stats !== null);
  const sameDirectionSignificant = valid.filter((window) => {
    const stats = window.stats!;
    return stats.p_value < 0.05 && referenceSign !== 0 && Math.sign(stats.sen_slope) === referenceSign;
  }).length;
  return {
    sameDirectionSignificant,
    tested: valid.length,
    percent: valid.length ? (sameDirectionSignificant / valid.length) * 100 : 0,
  };
}
