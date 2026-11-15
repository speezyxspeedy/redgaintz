import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Analysis, CycleMonth } from "./lib/analysis";
import { monthsInView } from "./lib/analysis";
import { olsLineAt, senLineAt } from "./lib/stats";
import { fmt } from "./lib/verdict";
import type { ViewSpec } from "./lib/sciTypes";

interface Accent {
  a: string;
  b: string;
}

const W = 880;
const H = 440;
const M = { l: 76, r: 26, t: 26, b: 70 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;

/** "Nice" tick values spanning [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 5): { ticks: number[]; step: number } {
  if (!(hi > lo)) {
    hi = lo + 1;
  }
  const raw = (hi - lo) / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const step = (frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10) * pow;
  const start = Math.ceil(lo / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = start; t <= hi + step * 1e-9; t += step) ticks.push(Math.round(t / step) * step);
  return { ticks, step };
}

function tickLabel(v: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  const s = Math.abs(v).toFixed(decimals);
  return `${v < 0 && Number(s) !== 0 ? "−" : ""}${Number(s).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function yearTicks(first: number, last: number): number[] {
  const span = last - first;
  const step = span <= 12 ? 1 : span <= 30 ? 5 : 10;
  const out: number[] = [];
  for (let y = Math.ceil(first / step) * step; y <= last; y += step) out.push(y);
  if (!out.includes(first) && out.length && out[0] - first >= step / 2) out.unshift(first);
  if (!out.includes(last) && last - out[out.length - 1] >= step / 2) out.push(last);
  return out;
}

function useChartInteraction(count: number, xOf: (i: number) => number) {
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !count) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < count; i++) {
      const d = Math.abs(xOf(i) - vx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setActive(best);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!count) return;
    if (e.key === "ArrowRight") setActive((a) => Math.min(count - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? count) - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(count - 1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };
  return { active, setActive, ref, onMove, onKey };
}

function AxisTitles({ x, y }: { x: string; y: string }) {
  return (
    <>
      <text className="ch-axis-title" x={M.l + PW / 2} y={H - 14} textAnchor="middle">
        {x}
      </text>
      <text className="ch-axis-title" transform={`translate(18 ${M.t + PH / 2}) rotate(-90)`} textAnchor="middle">
        {y}
      </text>
    </>
  );
}

function Tooltip({ xPct, yPct, children }: { xPct: number; yPct: number; children: React.ReactNode }) {
  const flip = xPct > 62;
  return (
    <div
      className="ch-tip"
      role="status"
      style={{ left: `${xPct}%`, top: `${Math.max(2, yPct)}%`, transform: `translate(${flip ? "calc(-100% - 14px)" : "14px"}, -10%)` }}
    >
      {children}
    </div>
  );
}

function LegendSwatch({ kind, color }: { kind: "dot" | "line" | "dash" | "band" | "dots" | "bar"; color: string }) {
  return (
    <svg width="30" height="12" aria-hidden="true">
      {kind === "dot" && <circle cx="15" cy="6" r="4" fill={color} />}
      {kind === "line" && <line x1="2" y1="6" x2="28" y2="6" stroke={color} strokeWidth="3" strokeLinecap="round" />}
      {kind === "dash" && <line x1="2" y1="6" x2="28" y2="6" stroke={color} strokeWidth="2" strokeDasharray="5 4" />}
      {kind === "dots" && <line x1="2" y1="6" x2="28" y2="6" stroke={color} strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" />}
      {kind === "band" && <rect x="2" y="1" width="26" height="10" rx="2" fill={color} fillOpacity="0.28" stroke={color} strokeOpacity="0.5" />}
      {kind === "bar" && <rect x="9" y="1" width="12" height="10" rx="2" fill={color} />}
    </svg>
  );
}

// ───────────────────────────── Trend chart ─────────────────────────────

export function TrendChart({ analysis, accent, title, compact = false }: { analysis: Analysis; accent: Accent; title: string; compact?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const { agg, stats } = analysis;
  const pts = useMemo(() => agg.years.map((y, i) => ({ y, v: agg.values[i] })).filter((p): p is { y: number; v: number } => p.v !== null), [agg]);
  const first = agg.years[0];
  const last = agg.years[agg.years.length - 1];
  const xOf = (year: number) => M.l + ((year - (first - 0.5)) / (last - first + 1)) * PW;

  const mean = pts.length ? pts.reduce((s, p) => s + p.v, 0) / pts.length : 0;
  const xBar = pts.length ? pts.reduce((s, p) => s + p.y, 0) / pts.length : 0;

  const band = useMemo(() => {
    if (!stats) return null;
    const yBar = senLineAt(stats, xBar);
    const [lo, hi] = stats.sen_slope_ci95;
    const at = (s: number, x: number) => yBar + s * (x - xBar);
    return { at, lo, hi };
  }, [stats, xBar]);

  const domain = useMemo(() => {
    const all: number[] = pts.map((p) => p.v);
    if (stats && band) {
      for (const x of [first, last]) {
        all.push(senLineAt(stats, x), band.at(band.lo, x), band.at(band.hi, x));
      }
    }
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (!Number.isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    const pad = (hi - lo || 1) * 0.1;
    return { lo: lo - pad, hi: hi + pad };
  }, [pts, stats, band, first, last]);

  const { ticks, step } = niceTicks(domain.lo, domain.hi, 5);
  const yOf = (v: number) => M.t + PH - ((v - domain.lo) / (domain.hi - domain.lo)) * PH;
  const inter = useChartInteraction(pts.length, (i) => xOf(pts[i].y));

  const linePath = pts.map((p, i) => `${i ? "L" : "M"}${xOf(p.y).toFixed(1)} ${yOf(p.v).toFixed(1)}`).join(" ");
  const areaPath = pts.length ? `${linePath} L${xOf(pts[pts.length - 1].y).toFixed(1)} ${M.t + PH} L${xOf(pts[0].y).toFixed(1)} ${M.t + PH} Z` : "";
  const bandPath = band
    ? `M${xOf(first)} ${yOf(band.at(band.lo, first))} L${xOf(last)} ${yOf(band.at(band.lo, last))} L${xOf(last)} ${yOf(band.at(band.hi, last))} L${xOf(first)} ${yOf(band.at(band.hi, first))} Z`
    : "";
  const skipped = agg.yearsSkipped.map((s) => s.year);
  const ap = inter.active !== null ? pts[inter.active] : null;

  const summary = stats
    ? `${title}. ${agg.label}, ${pts.length} years from ${pts[0]?.y} to ${pts[pts.length - 1]?.y}. Typical change ${fmt(stats.sen_slope * 10, true)} ${agg.units} per decade.`
    : `${title}. ${agg.label}, ${pts.length} years.`;

  return (
    <figure className={`chart ${compact ? "chart--compact" : ""}`}>
      <div className="chart-wrap">
        <svg
          ref={inter.ref}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onPointerMove={inter.onMove}
          onPointerLeave={() => inter.setActive(null)}
          onKeyDown={inter.onKey}
          onBlur={() => inter.setActive(null)}
        >
          <title>{title}</title>
          <desc>{summary} Use the left and right arrow keys to step through the years.</desc>
          <defs>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={accent.a} stopOpacity="0.38" />
              <stop offset="1" stopColor={accent.a} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={accent.a} />
              <stop offset="1" stopColor={accent.b} />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line className="ch-grid" x1={M.l} x2={W - M.r} y1={yOf(t)} y2={yOf(t)} />
              <text className="ch-tick" x={M.l - 10} y={yOf(t) + 4} textAnchor="end">
                {tickLabel(t, step)}
              </text>
            </g>
          ))}
          {yearTicks(first, last).map((y) => (
            <g key={y}>
              <line className="ch-tickmark" x1={xOf(y)} x2={xOf(y)} y1={M.t + PH} y2={M.t + PH + 6} />
              <text className="ch-tick" x={xOf(y)} y={M.t + PH + 22} textAnchor="middle">
                {y}
              </text>
            </g>
          ))}
          <line className="ch-axis" x1={M.l} x2={W - M.r} y1={M.t + PH} y2={M.t + PH} />

          {bandPath && <path d={bandPath} fill={accent.b} fillOpacity="0.18" stroke={accent.b} strokeOpacity="0.45" strokeWidth="1" />}
          <line className="ch-mean" x1={M.l} x2={W - M.r} y1={yOf(mean)} y2={yOf(mean)} />
          <text className="ch-note" x={W - M.r - 4} y={yOf(mean) - 6} textAnchor="end">
            average {fmt(mean)} {agg.units}
          </text>
          {areaPath && <path d={areaPath} fill={`url(#area-${uid})`} />}
          <path className="ch-line-glow" d={linePath} stroke={accent.a} />
          <path className="ch-line" d={linePath} stroke={`url(#line-${uid})`} />

          {stats && (
            <>
              <line className="ch-ols" x1={xOf(first)} x2={xOf(last)} y1={yOf(olsLineAt(stats, first))} y2={yOf(olsLineAt(stats, last))} />
              <line className="ch-sen" x1={xOf(first)} x2={xOf(last)} y1={yOf(senLineAt(stats, first))} y2={yOf(senLineAt(stats, last))} />
            </>
          )}

          {pts.map((p, i) => (
            <circle key={p.y} className={`ch-dot ${inter.active === i ? "is-active" : ""}`} cx={xOf(p.y)} cy={yOf(p.v)} r={inter.active === i ? 6 : compact ? 2.5 : 3.6} fill={accent.a} />
          ))}
          {skipped.map((y) => (
            <g key={`s${y}`}>
              <circle cx={xOf(y)} cy={M.t + PH - 8} r="3.5" className="ch-skip" />
              <title>{`${y}: skipped (missing months)`}</title>
            </g>
          ))}
          {ap && <line className="ch-cursor" x1={xOf(ap.y)} x2={xOf(ap.y)} y1={M.t} y2={M.t + PH} />}
          <AxisTitles x="Year" y={`${agg.label} (${agg.units})`} />
        </svg>
        {ap && (
          <Tooltip xPct={(xOf(ap.y) / W) * 100} yPct={(yOf(ap.v) / H) * 100}>
            <strong>{ap.y}</strong>
            <span className="tip-val">
              {fmt(ap.v)} {agg.units}
            </span>
            <span className="tip-sub">
              {ap.v >= mean ? "above" : "below"} the average by {fmt(Math.abs(ap.v - mean))}
            </span>
          </Tooltip>
        )}
      </div>
      {!compact && (
        <figcaption className="legend">
          <span><LegendSwatch kind="dot" color={accent.a} /> Yearly value</span>
          <span><LegendSwatch kind="line" color="#f8fafc" /> Sen's trend line</span>
          <span><LegendSwatch kind="dash" color="#fbbf24" /> Straight-line fit (OLS)</span>
          <span><LegendSwatch kind="band" color={accent.b} /> 95% confidence range</span>
          <span><LegendSwatch kind="dots" color="#94a3b8" /> Average</span>
          {skipped.length > 0 && <span><svg width="14" height="12" aria-hidden="true"><circle cx="7" cy="6" r="4" className="ch-skip" /></svg> Skipped year</span>}
        </figcaption>
      )}
    </figure>
  );
}

// ───────────────────────────── Above / below average bars ─────────────────────────────

export function BarsChart({ analysis, title }: { analysis: Analysis; title: string }) {
  const { agg } = analysis;
  const pts = useMemo(() => agg.years.map((y, i) => ({ y, v: agg.values[i] })).filter((p): p is { y: number; v: number } => p.v !== null), [agg]);
  const mean = pts.length ? pts.reduce((s, p) => s + p.v, 0) / pts.length : 0;
  const first = agg.years[0];
  const last = agg.years[agg.years.length - 1];
  const xOf = (year: number) => M.l + ((year - (first - 0.5)) / (last - first + 1)) * PW;
  const devs = pts.map((p) => p.v - mean);
  const maxAbs = Math.max(1e-9, ...devs.map(Math.abs)) * 1.12;
  const { ticks, step } = niceTicks(-maxAbs, maxAbs, 6);
  const yOf = (d: number) => M.t + PH / 2 - (d / maxAbs) * (PH / 2);
  const bw = Math.max(3, (PW / (last - first + 1)) * 0.68);
  const inter = useChartInteraction(pts.length, (i) => xOf(pts[i].y));
  const ap = inter.active !== null ? pts[inter.active] : null;

  return (
    <figure className="chart">
      <div className="chart-wrap">
        <svg
          ref={inter.ref}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}. Bars show each year above or below the ${pts.length}-year average of ${fmt(mean)} ${agg.units}.`}
          tabIndex={0}
          onPointerMove={inter.onMove}
          onPointerLeave={() => inter.setActive(null)}
          onKeyDown={inter.onKey}
          onBlur={() => inter.setActive(null)}
        >
          <title>{title}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line className="ch-grid" x1={M.l} x2={W - M.r} y1={yOf(t)} y2={yOf(t)} />
              <text className="ch-tick" x={M.l - 10} y={yOf(t) + 4} textAnchor="end">
                {t > 0 ? "+" : ""}
                {tickLabel(t, step)}
              </text>
            </g>
          ))}
          {yearTicks(first, last).map((y) => (
            <g key={y}>
              <line className="ch-tickmark" x1={xOf(y)} x2={xOf(y)} y1={M.t + PH} y2={M.t + PH + 6} />
              <text className="ch-tick" x={xOf(y)} y={M.t + PH + 22} textAnchor="middle">
                {y}
              </text>
            </g>
          ))}
          {pts.map((p, i) => {
            const d = p.v - mean;
            const y0 = yOf(0);
            const y1 = yOf(d);
            return (
              <rect
                key={p.y}
                className={`ch-bar ${d >= 0 ? "is-above" : "is-below"} ${inter.active === i ? "is-active" : ""}`}
                x={xOf(p.y) - bw / 2}
                width={bw}
                y={Math.min(y0, y1)}
                height={Math.max(1, Math.abs(y1 - y0))}
                rx="2"
              />
            );
          })}
          <line className="ch-zero" x1={M.l} x2={W - M.r} y1={yOf(0)} y2={yOf(0)} />
          <text className="ch-note" x={M.l + 8} y={M.t + 14}>▲ above average</text>
          <text className="ch-note" x={M.l + 8} y={M.t + PH - 8}>▼ below average</text>
          {ap && <line className="ch-cursor" x1={xOf(ap.y)} x2={xOf(ap.y)} y1={M.t} y2={M.t + PH} />}
          <AxisTitles x="Year" y={`Difference from average (${agg.units})`} />
        </svg>
        {ap && (
          <Tooltip xPct={(xOf(ap.y) / W) * 100} yPct={(yOf(ap.v - mean) / H) * 100}>
            <strong>{ap.y}</strong>
            <span className="tip-val">
              {fmt(ap.v - mean, true)} {agg.units}
            </span>
            <span className="tip-sub">
              value {fmt(ap.v)}, average {fmt(mean)}
            </span>
          </Tooltip>
        )}
      </div>
      <figcaption className="legend">
        <span><LegendSwatch kind="bar" color="var(--above)" /> Above the {pts.length}-year average</span>
        <span><LegendSwatch kind="bar" color="var(--below)" /> Below the average</span>
        <span>Average: {fmt(mean)} {agg.units}</span>
      </figcaption>
    </figure>
  );
}

// ───────────────────────────── Seasonal cycle ─────────────────────────────

export function SeasonalChart({ months, units, view, accent, title, quantity }: { months: CycleMonth[]; units: string; view: ViewSpec; accent: Accent; title: string; quantity: string }) {
  const used = new Set(monthsInView(view));
  const vals = months.flatMap((m) => (m.max === null ? [] : [m.max, m.min as number]));
  const lo = Math.min(0, ...vals, ...months.flatMap((m) => (m.mean === null ? [] : [m.mean])));
  const hi = Math.max(1e-9, ...vals);
  const pad = (hi - lo) * 0.08;
  const dLo = lo < 0 ? lo - pad : 0 === lo && vals.every((v) => v > lo + (hi - lo) * 0.4) ? Math.max(0, Math.min(...vals) - (hi - lo) * 0.2) : lo;
  const dHi = hi + pad;
  const { ticks, step } = niceTicks(dLo, dHi, 5);
  const yOf = (v: number) => M.t + PH - ((v - dLo) / (dHi - dLo)) * PH;
  const slot = PW / 12;
  const xOf = (i: number) => M.l + slot * (i + 0.5);
  const inter = useChartInteraction(12, xOf);
  const am = inter.active !== null ? months[inter.active] : null;
  const means = months.map((m, i) => (m.mean === null ? null : ([xOf(i), yOf(m.mean)] as const)));
  const path = means.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p![0].toFixed(1)} ${p![1].toFixed(1)}`).join(" ");

  return (
    <figure className="chart">
      <div className="chart-wrap">
        <svg
          ref={inter.ref}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}. The typical ${quantity} for each calendar month.`}
          tabIndex={0}
          onPointerMove={inter.onMove}
          onPointerLeave={() => inter.setActive(null)}
          onKeyDown={inter.onKey}
          onBlur={() => inter.setActive(null)}
        >
          <title>{title}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line className="ch-grid" x1={M.l} x2={W - M.r} y1={yOf(t)} y2={yOf(t)} />
              <text className="ch-tick" x={M.l - 10} y={yOf(t) + 4} textAnchor="end">
                {tickLabel(t, step)}
              </text>
            </g>
          ))}
          {months.map((m, i) => (
            <g key={m.month} opacity={used.has(m.month) ? 1 : 0.38}>
              {m.mean !== null && m.min !== null && m.max !== null && (
                <>
                  <rect className={`ch-cyc ${inter.active === i ? "is-active" : ""}`} x={xOf(i) - slot * 0.3} width={slot * 0.6} y={yOf(m.mean)} height={Math.max(1, M.t + PH - yOf(m.mean))} rx="5" fill={accent.a} fillOpacity="0.55" />
                  <line className="ch-whisker" x1={xOf(i)} x2={xOf(i)} y1={yOf(m.min)} y2={yOf(m.max)} />
                  <line className="ch-whisker" x1={xOf(i) - 6} x2={xOf(i) + 6} y1={yOf(m.max)} y2={yOf(m.max)} />
                  <line className="ch-whisker" x1={xOf(i) - 6} x2={xOf(i) + 6} y1={yOf(m.min)} y2={yOf(m.min)} />
                </>
              )}
              <text className="ch-tick" x={xOf(i)} y={M.t + PH + 22} textAnchor="middle">{m.label}</text>
            </g>
          ))}
          <line className="ch-axis" x1={M.l} x2={W - M.r} y1={M.t + PH} y2={M.t + PH} />
          {path && <path className="ch-line" d={path} stroke={accent.b} style={{ strokeWidth: 2.5 }} />}
          {am && <line className="ch-cursor" x1={xOf(inter.active!)} x2={xOf(inter.active!)} y1={M.t} y2={M.t + PH} />}
          <AxisTitles x="Month of the year" y={`${quantity} (${units})`} />
        </svg>
        {am && am.mean !== null && am.min !== null && am.max !== null && (
          <Tooltip xPct={(xOf(inter.active!) / W) * 100} yPct={(yOf(am.mean) / H) * 100}>
            <strong>{am.label}</strong>
            <span className="tip-val">{fmt(am.mean)} {units}</span>
            <span className="tip-sub">lowest {fmt(am.min)}, highest {fmt(am.max)} ({am.n} years)</span>
          </Tooltip>
        )}
      </div>
      <figcaption className="legend">
        <span><LegendSwatch kind="bar" color={accent.a} /> Average for the month</span>
        <span><LegendSwatch kind="line" color={accent.b} /> Seasonal cycle</span>
        <span>Whiskers: lowest and highest year</span>
        {used.size < 12 && <span>Dimmed months are not part of this view</span>}
      </figcaption>
    </figure>
  );
}

// ───────────────────────────── Sparkline ─────────────────────────────

export function Sparkline({ values, color, width = 120, height = 36 }: { values: Array<number | null>; color: string; width?: number; height?: number }) {
  const id = useId().replace(/:/g, "");
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const n = values.length;
  const pt = (v: number, i: number) => `${((i / (n - 1)) * (width - 4) + 2).toFixed(1)} ${(height - 3 - ((v - lo) / span) * (height - 8)).toFixed(1)}`;
  const d = values.map((v, i) => (v === null ? null : `${pt(v, i)}`)).filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="spark">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${width - 2} ${height} L2 ${height} Z`} fill={`url(#sp-${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
