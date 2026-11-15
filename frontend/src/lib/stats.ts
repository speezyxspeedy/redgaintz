/**
 * TERRASCAN statistics module (pure TypeScript, no dependencies).
 *
 * Mirrors pipeline/trend.py (Mann-Kendall with tie-corrected variance,
 * Sen's slope + CI as in scipy.stats.theilslopes, OLS, lag-1 autocorrelation)
 * so browser results can be checked against Python to ~1e-6.
 * Field names are snake_case on purpose: they match the existing TrendResult
 * shape and tests/fixtures/stats_expected.json.
 */

// ───────────────────────── special functions ─────────────────────────

const EPS = 1e-15;
const FPMIN = 1e-300;

function lnGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }
  const xm = x - 1;
  let a = c[0];
  const t = xm + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (xm + i);
  return 0.5 * Math.log(2 * Math.PI) + (xm + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularised upper incomplete gamma Q(a, x). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  const lead = Math.exp(-x + a * Math.log(x) - lnGamma(a));
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPS) break;
    }
    return 1 - sum * lead;
  }
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return lead * h;
}

export function erfc(x: number): number {
  const q = gammaQ(0.5, x * x);
  return x >= 0 ? q : 2 - q;
}

/** Two-sided normal p-value for a z statistic. */
export function normTwoSidedP(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
function betai(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided Student-t p-value. */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return betai(df / (df + t * t), df / 2, 0.5);
}

/** Positive t such that two-sided p = alpha (i.e. scipy t.ppf(1 - alpha/2, df)). */
export function tCritical(alpha: number, df: number): number {
  let lo = 0;
  let hi = 1;
  while (tTwoSidedP(hi, df) > alpha && hi < 1e12) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Positive z such that two-sided normal p = alpha (i.e. -scipy norm.ppf(alpha/2)). */
export function zCritical(alpha: number): number {
  let lo = 0;
  let hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (normTwoSidedP(mid) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ───────────────────────── small helpers ─────────────────────────

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Round half to even, like numpy.round. */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) return r - 1;
  return r;
}

function mean(a: number[]): number {
  return a.reduce((s, v) => s + v, 0) / a.length;
}

function stdPop(a: number[]): number {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
}

function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}

// ───────────────────────── OLS ─────────────────────────

export interface OlsResult {
  slope: number;
  intercept: number;
  stderr: number;
  t: number;
  p_value: number;
  slope_ci95: [number, number];
  df: number;
}

export function ols(x: number[], y: number[], alpha = 0.05): OlsResult {
  const n = x.length;
  if (n !== y.length) throw new Error("x and y must have equal lengths.");
  if (n < 3) throw new Error("OLS needs at least three points.");
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const df = n - 2;
  // Same construction as scipy.stats.linregress (TINY guards r = +-1).
  const TINY = 1e-20;
  let r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  r = Math.max(-1, Math.min(1, r));
  const t = r * Math.sqrt(df / ((1 - r + TINY) * (1 + r + TINY)));
  const p_value = tTwoSidedP(t, df);
  const stderr = Math.sqrt(Math.max(0, (1 - r * r) * (syy / sxx) / df));
  const tc = tCritical(alpha, df);
  return {
    slope,
    intercept,
    stderr,
    t,
    p_value,
    slope_ci95: [slope - tc * stderr, slope + tc * stderr],
    df,
  };
}

// ───────────────────────── Mann-Kendall + Sen ─────────────────────────

export interface TrendStats {
  method: string;
  sample_count: number;
  alpha: number;
  mk_score: number;
  mk_z: number;
  p_value: number;
  significant: boolean;
  direction: "increasing" | "decreasing" | "no_significant_trend";
  sen_slope: number;
  sen_slope_ci95: [number, number];
  sen_intercept: number;
  ols_slope: number;
  ols_intercept: number;
  ols_stderr: number;
  ols_t: number;
  ols_p_value: number;
  ols_slope_ci95: [number, number];
  lag1_autocorrelation: number | null;
  lag1_autocorrelation_threshold: number;
  lag1_autocorrelation_flag: boolean;
  span_years: number;
  total_change: number;
  observed_mean: number;
  percent_change_of_mean: number | null;
  missing_years_excluded: number;
  interpretation: string;
}

function lag1(years: number[], residuals: number[]): number | null {
  const prev: number[] = [];
  const cur: number[] = [];
  for (let i = 0; i < years.length - 1; i++) {
    if (years[i + 1] - years[i] === 1) {
      prev.push(residuals[i]);
      cur.push(residuals[i + 1]);
    }
  }
  if (prev.length < 3) return null;
  if (stdPop(prev) === 0 || stdPop(cur) === 0) return 0;
  const v = pearson(prev, cur);
  return Number.isFinite(v) ? v : null;
}

/** Sum over tie groups of k(k-1)(2k+5). */
function tieTerm(sortedValues: number[]): number {
  let term = 0;
  let run = 1;
  for (let i = 1; i <= sortedValues.length; i++) {
    if (i < sortedValues.length && sortedValues[i] === sortedValues[i - 1]) {
      run++;
    } else {
      term += run * (run - 1) * (2 * run + 5);
      run = 1;
    }
  }
  return term;
}

/**
 * Port of pipeline.trend.mann_kendall_sen. `years`/`values` may contain
 * null/NaN values; they are dropped and counted in missing_years_excluded.
 * Throws for < 3 usable points or non-increasing years, like the Python.
 */
export function analyseTrend(
  years: ReadonlyArray<number>,
  values: ReadonlyArray<number | null>,
  alpha = 0.05,
): TrendStats {
  if (years.length !== values.length) {
    throw new Error("Years and values must have equal lengths.");
  }
  if (!(alpha > 0 && alpha < 1)) throw new Error("alpha must be between 0 and 1.");

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < years.length; i++) {
    const v = values[i];
    if (v !== null && Number.isFinite(v) && Number.isFinite(years[i])) {
      pairs.push([years[i], v]);
    }
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const x = pairs.map((p) => p[0]);
  const y = pairs.map((p) => p[1]);
  const n = y.length;
  if (n < 3) throw new Error("At least three non-missing annual observations are required.");
  for (let i = 1; i < n; i++) {
    if (x[i] - x[i - 1] <= 0) {
      throw new Error("Observation years must be unique and strictly increasing.");
    }
  }

  // Mann-Kendall
  let score = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) score += Math.sign(y[j] - y[i]);
  }
  const ySorted = [...y].sort((a, b) => a - b);
  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm(ySorted)) / 18;
  let z = 0;
  let p = 1;
  if (variance > 0 && score !== 0) {
    z = (score > 0 ? score - 1 : score + 1) / Math.sqrt(variance);
    p = normTwoSidedP(z);
  }

  // Sen's slope and CI (scipy.stats.theilslopes, method "separate")
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
  }
  slopes.sort((a, b) => a - b);
  const senSlope = median(slopes);
  const senIntercept = median(y.map((v, i) => v - senSlope * x[i]).sort((a, b) => a - b));
  let ciAlpha = 1 - alpha;
  if (ciAlpha > 0.5) ciAlpha = 1 - ciAlpha;
  const zc = zCritical(ciAlpha);
  const nt = slopes.length;
  // x is strictly increasing, so x has no ties.
  const sigsq = (n * (n - 1) * (2 * n + 5) - tieTerm(ySorted)) / 18;
  let ci: [number, number] = [NaN, NaN];
  if (sigsq >= 0) {
    const sigma = Math.sqrt(sigsq);
    const ru = Math.min(roundHalfEven((nt + zc * sigma) / 2), nt - 1);
    const rl = Math.max(roundHalfEven((nt - zc * sigma) / 2) - 1, 0);
    ci = [slopes[rl], slopes[ru]];
  }

  // OLS + autocorrelation of OLS residuals
  const fit = ols(x, y, alpha);
  const residuals = y.map((v, i) => v - (fit.intercept + fit.slope * x[i]));
  const rho = lag1(x, residuals);
  const threshold = 2 / Math.sqrt(n);
  const flag = rho !== null && Math.abs(rho) > threshold;

  const significant = p <= alpha;
  const direction = significant && score > 0 ? "increasing"
    : significant && score < 0 ? "decreasing" : "no_significant_trend";
  const spanYears = x[n - 1] - x[0];
  const observedMean = mean(y);
  const totalChange = senSlope * spanYears;

  return {
    method: "Mann-Kendall with tie-corrected variance; Sen's slope",
    sample_count: n,
    alpha,
    mk_score: score,
    mk_z: z,
    p_value: p,
    significant,
    direction,
    sen_slope: senSlope,
    sen_slope_ci95: ci,
    sen_intercept: senIntercept,
    ols_slope: fit.slope,
    ols_intercept: fit.intercept,
    ols_stderr: fit.stderr,
    ols_t: fit.t,
    ols_p_value: fit.p_value,
    ols_slope_ci95: fit.slope_ci95,
    lag1_autocorrelation: rho,
    lag1_autocorrelation_threshold: threshold,
    lag1_autocorrelation_flag: flag,
    span_years: spanYears,
    total_change: totalChange,
    observed_mean: observedMean,
    percent_change_of_mean: observedMean !== 0 ? (totalChange / observedMean) * 100 : null,
    missing_years_excluded: years.length - n,
    interpretation: "Statistical trend only; this result does not establish causation.",
  };
}

/** y-value of the Sen trend line at a given x (for chart overlays). */
export function senLineAt(stats: TrendStats, x: number): number {
  return stats.sen_intercept + stats.sen_slope * x;
}

/** y-value of the OLS line at a given x. */
export function olsLineAt(stats: TrendStats, x: number): number {
  return stats.ols_intercept + stats.ols_slope * x;
}
