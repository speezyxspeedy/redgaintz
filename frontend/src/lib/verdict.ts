import type { TrendStats } from "./stats";

export interface VerdictInput {
  stats: TrendStats;
  /** Plain name, e.g. "Rainfall". */
  variableName: string;
  /** e.g. "Monsoon (Jun–Sep) total". */
  viewLabel: string;
  /** Units of the analysed values, e.g. "mm", "°C", "%". */
  units: string;
  firstYear: number;
  lastYear: number;
  /** Years dropped because of missing months. */
  yearsSkipped: number;
  /** Set true for anomaly views, where "% of the average" is meaningless. */
  hidePercent?: boolean;
}

export interface Verdict {
  headline: string;
  direction: TrendStats["direction"];
  significant: boolean;
  /** Short text such as "+80.9 mm per decade". */
  rate_per_decade: string;
  /** Plain-English sentences describing the result. */
  lines: string[];
  warnings: string[];
  /** One paragraph with everything above, for the chat assistant. */
  plain: string;
}

/** Three significant figures, with a real minus sign and an explicit plus. */
export function fmt(x: number, signed = false): string {
  if (!Number.isFinite(x)) return "n/a";
  const a = Math.abs(x);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4;
  const body = a.toFixed(digits);
  const isZero = Number(body) === 0;
  const sign = isZero ? "" : x < 0 ? "−" : signed ? "+" : "";
  return `${sign}${body}`;
}

export function fmtP(p: number): string {
  if (p < 0.001) return "below 0.001";
  return p.toFixed(3);
}

export function buildVerdict(input: VerdictInput): Verdict {
  const { stats, variableName, viewLabel, units, firstYear, lastYear, yearsSkipped } = input;
  const alpha = stats.alpha;
  const significant = stats.significant;
  const dir = stats.direction;
  const perDecade = stats.sen_slope * 10;
  const rate_per_decade = `${fmt(perDecade, true)} ${units} per decade`;
  const [ciLow, ciHigh] = stats.sen_slope_ci95;

  const headline = significant
    ? `${variableName} (${viewLabel}) shows a statistically significant ${dir === "increasing" ? "upward" : "downward"} trend.`
    : `${variableName} (${viewLabel}) shows no statistically significant trend.`;

  const lines: string[] = [];
  lines.push(
    `Typical change (Sen's slope): ${fmt(stats.sen_slope, true)} ${units} per year, which is ${rate_per_decade}.` +
      (Number.isFinite(ciLow) && Number.isFinite(ciHigh)
        ? ` The 95% confidence range is ${fmt(ciLow * 10, true)} to ${fmt(ciHigh * 10, true)} ${units} per decade.`
        : ""),
  );
  let total = `Over ${firstYear}–${lastYear} this adds up to about ${fmt(stats.total_change, true)} ${units}`;
  if (!input.hidePercent && stats.percent_change_of_mean !== null && Number.isFinite(stats.percent_change_of_mean)) {
    total += `, or ${fmt(stats.percent_change_of_mean, true)}% of the average value (${fmt(stats.observed_mean)} ${units})`;
  }
  lines.push(`${total}.`);

  if (significant) {
    lines.push(
      `Mann–Kendall test: p = ${fmtP(stats.p_value)}, below the ${alpha} threshold, so a change this consistent would be unlikely to arise from chance ups and downs alone.`,
    );
  } else {
    lines.push(
      `Mann–Kendall test: p = ${fmtP(stats.p_value)}, not below the ${alpha} threshold. The data do not show a trend that stands out from normal year-to-year variation. This does not prove that nothing changed.`,
    );
  }
  lines.push(
    `Based on ${stats.sample_count} years of data${yearsSkipped ? ` (${yearsSkipped} skipped because of missing months)` : ""}.`,
  );

  const warnings: string[] = [];
  if (stats.lag1_autocorrelation_flag && stats.lag1_autocorrelation !== null) {
    warnings.push(
      `Neighbouring years are correlated (lag-1 autocorrelation ${fmt(stats.lag1_autocorrelation, true)}), so the p-value may look more certain than it really is.`,
    );
  }
  if (Math.sign(stats.ols_slope) !== Math.sign(stats.sen_slope) && stats.ols_slope !== 0 && stats.sen_slope !== 0) {
    warnings.push("The straight-line fit (OLS) and Sen's slope point in opposite directions, so the result is sensitive to a few extreme years.");
  }
  if (stats.sample_count < 15) {
    warnings.push(`Only ${stats.sample_count} years were used. Short records can show trends that disappear with more data.`);
  }
  if (significant && Number.isFinite(ciLow) && Number.isFinite(ciHigh) && ciLow <= 0 && ciHigh >= 0) {
    warnings.push("The confidence range for the yearly change touches zero, so this result is borderline.");
  }
  warnings.push("A trend shows that something changed, not why. It does not identify a cause.");

  const plain = [headline, ...lines, ...warnings].join(" ");
  return { headline, direction: dir, significant, rate_per_decade, lines, warnings, plain };
}
