import { erfc, normTwoSidedP, tCritical, tTwoSidedP } from "./stats";

export const phi = (z: number) => 0.5 * erfc(-z / Math.SQRT2);
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
export function quantile(a: number[], q: number) {
  const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return s[lo] + (s[hi] - s[lo]) * (p - lo);
}

/** Pettitt (1979) change-point test. p is the standard approximation 2·exp(−6K²/(n³+n²)). */
export function pettitt(y: number[]) {
  const n = y.length; let K = 0, at = 0;
  const U: number[] = [];
  for (let t = 0; t < n - 1; t++) { let s = 0; for (let i = 0; i <= t; i++) for (let j = t + 1; j < n; j++) s += Math.sign(y[i] - y[j]); U.push(s); }
  U.forEach((v, t) => { if (Math.abs(v) > K) { K = Math.abs(v); at = t; } });
  const p = Math.min(1, 2 * Math.exp((-6 * K * K) / (n ** 3 + n ** 2)));
  return { index: at, K, p, significant: p < 0.05, before: mean(y.slice(0, at + 1)), after: mean(y.slice(at + 1)) };
}

/** Mann–Whitney U (normal approximation, tie-corrected) and Welch t for two samples. */
export function compareSamples(a: number[], b: number[]) {
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  const rank = new Array(all.length).fill(0); let tie = 0;
  for (let i = 0; i < all.length;) { let j = i; while (j + 1 < all.length && all[j + 1].v === all[i].v) j++; const r = (i + j) / 2 + 1; for (let k = i; k <= j; k++) rank[k] = r; const t = j - i + 1; tie += t ** 3 - t; i = j + 1; }
  const n1 = a.length, n2 = b.length, N = n1 + n2;
  const R1 = all.reduce((s, o, i) => s + (o.g === 0 ? rank[i] : 0), 0);
  const U = R1 - (n1 * (n1 + 1)) / 2, mu = (n1 * n2) / 2;
  const sig = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tie / (N * (N - 1))));
  const z = sig > 0 ? (U - mu) / sig : 0;
  const v1 = sd(a) ** 2 / n1, v2 = sd(b) ** 2 / n2, se = Math.sqrt(v1 + v2);
  const df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));
  const t = se > 0 ? (mean(b) - mean(a)) / se : 0;
  return { mwP: normTwoSidedP(z), welchP: Number.isFinite(df) ? tTwoSidedP(t, df) : 1, diff: mean(b) - mean(a) };
}

export interface Advanced {
  n: number; units: string; mean: number; sd: number;
  ecdf: { x: number; p: number }[];
  hist: { label: string; mid: number; count: number }[];
  rolling: { year: number; value: number; roll: number | null }[];
  pettitt: ReturnType<typeof pettitt> & { year: number };
  compare: ReturnType<typeof compareSamples> & { earlyMean: number; lateMean: number; earlyLabel: string; lateLabel: string };
  baseline: { label: string; lowThr: number; highThr: number };
  prob: { lowObserved: number; highObserved: number; lowNext: number; highNext: number; recentLabel: string };
  returns: { year: number; value: number; period: number }[];
  forecast: { year: number; value: number | null; fit: number; lo: number; hi: number }[];
}

export function advancedStats(years: number[], values: Array<number | null>, units: string): Advanced | null {
  const pts = years.map((y, i) => ({ y, v: values[i] })).filter((p): p is { y: number; v: number } => p.v !== null && Number.isFinite(p.v));
  const n = pts.length;
  if (n < 10) return null;
  const x = pts.map((p) => p.y), y = pts.map((p) => p.v), m = mean(y), s = sd(y);

  const sorted = [...y].sort((a, b) => a - b);
  const ecdf = sorted.map((v, i) => ({ x: v, p: (i + 1) / n }));
  const bins = Math.max(5, Math.ceil(Math.log2(n) + 1)), lo = sorted[0], hi = sorted[n - 1], w = (hi - lo) / bins || 1;
  const hist = Array.from({ length: bins }, (_, i) => ({ mid: lo + w * (i + 0.5), label: (lo + w * i).toFixed(1), count: 0 }));
  y.forEach((v) => { hist[Math.min(bins - 1, Math.floor((v - lo) / w))].count++; });

  const W = 10;
  const rolling = pts.map((p, i) => ({ year: p.y, value: p.v, roll: i >= W - 1 ? mean(y.slice(i - W + 1, i + 1)) : null }));

  const pt = pettitt(y);
  const cpYear = x[pt.index];
  const half = Math.floor(n / 2);
  const cmp = compareSamples(y.slice(0, half), y.slice(half));

  const bn = Math.max(8, Math.floor(n / 2));
  const base = y.slice(0, bn), lowThr = quantile(base, 0.1), highThr = quantile(base, 0.9);
  const rn = Math.min(15, n - bn > 4 ? n - bn : 15), recent = y.slice(-rn);

  // OLS fit with prediction intervals
  const xm = mean(x), Sxx = x.reduce((a, v) => a + (v - xm) ** 2, 0);
  const b1 = x.reduce((a, v, i) => a + (v - xm) * (y[i] - m), 0) / Sxx, b0 = m - b1 * xm;
  const res = y.map((v, i) => v - (b0 + b1 * x[i])), se = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / (n - 2));
  const tc = tCritical(0.05, n - 2);
  const pred = (yr: number) => { const f = b0 + b1 * yr, pe = se * Math.sqrt(1 + 1 / n + (yr - xm) ** 2 / Sxx); return { f, pe }; };
  const nextYr = x[n - 1] + 1, nx = pred(nextYr);

  const returns = sorted.slice(0, 3).map((v, i) => ({ year: x[y.indexOf(v)], value: v, period: (n + 1) / (i + 1) }));
  const forecast = [
    ...pts.map((p) => { const q = pred(p.y); return { year: p.y, value: p.v as number | null, fit: q.f, lo: q.f - tc * q.pe, hi: q.f + tc * q.pe }; }),
    ...[1, 2, 3, 4, 5].map((k) => { const q = pred(x[n - 1] + k); return { year: x[n - 1] + k, value: null, fit: q.f, lo: q.f - tc * q.pe, hi: q.f + tc * q.pe }; }),
  ];

  return {
    n, units, mean: m, sd: s, ecdf, hist, rolling,
    pettitt: { ...pt, year: cpYear },
    compare: { ...cmp, earlyMean: mean(y.slice(0, half)), lateMean: mean(y.slice(half)), earlyLabel: `${x[0]}–${x[half - 1]}`, lateLabel: `${x[half]}–${x[n - 1]}` },
    baseline: { label: `${x[0]}–${x[bn - 1]}`, lowThr, highThr },
    prob: {
      lowObserved: recent.filter((v) => v <= lowThr).length / rn, highObserved: recent.filter((v) => v >= highThr).length / rn,
      lowNext: phi((lowThr - nx.f) / nx.pe), highNext: 1 - phi((highThr - nx.f) / nx.pe), recentLabel: `${x[n - rn]}–${x[n - 1]}`,
    },
    returns, forecast,
  };
}
